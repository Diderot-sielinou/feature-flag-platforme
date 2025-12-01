import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  managementService: ecs.FargateService;
  readService: ecs.FargateService;
  alb: elbv2.ApplicationLoadBalancer;
  alarmEmail: string;
}

/**
 * Stack responsable du monitoring:
 * - CloudWatch Dashboard pour la visualisation
 * - Alarmes CloudWatch pour les alertes
 * - SNS Topic pour les notifications
 */
export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // ========================================
    // SNS Topic pour les alertes
    // ========================================
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'feature-flags-alarms',
      displayName: 'Feature Flags - Alarms',
    });

    // Subscription email
    this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(props.alarmEmail));

    // ========================================
    // CloudWatch Dashboard
    // ========================================
    this.dashboard = new cloudwatch.Dashboard(this, 'FeatureFlagsDashboard', {
      dashboardName: 'FeatureFlags-Overview',
    });

    // ========================================
    // Métriques ALB
    // ========================================
    const requestCountMetric = props.alb.metricRequestCount({
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const latencyP50Metric = props.alb.metricTargetResponseTime({
      statistic: 'p50',
      period: cdk.Duration.minutes(1),
    });

    const latencyP99Metric = props.alb.metricTargetResponseTime({
      statistic: 'p99',
      period: cdk.Duration.minutes(1),
    });

    const http2xxMetric = props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_2XX_COUNT, {
      period: cdk.Duration.minutes(1),
    });

    const http4xxMetric = props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_4XX_COUNT, {
      period: cdk.Duration.minutes(1),
    });

    const http5xxMetric = props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
      period: cdk.Duration.minutes(1),
    });

    // ========================================
    // Métriques ECS
    // ========================================
    const managementCpuMetric = props.managementService.metricCpuUtilization({
      period: cdk.Duration.minutes(1),
    });

    const managementMemoryMetric = props.managementService.metricMemoryUtilization({
      period: cdk.Duration.minutes(1),
    });

    const readCpuMetric = props.readService.metricCpuUtilization({
      period: cdk.Duration.minutes(1),
    });

    const readMemoryMetric = props.readService.metricMemoryUtilization({
      period: cdk.Duration.minutes(1),
    });

    // ========================================
    // Alarmes
    // ========================================

    // Alarme: Latence Read API > 50ms (p99)
    const readLatencyAlarm = new cloudwatch.Alarm(this, 'ReadLatencyAlarm', {
      alarmName: 'FeatureFlags-ReadAPI-HighLatency',
      alarmDescription: 'Read API p99 latency exceeds 50ms',
      metric: latencyP99Metric,
      threshold: 0.05, // 50ms en secondes
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    readLatencyAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
    readLatencyAlarm.addOkAction(new actions.SnsAction(this.alarmTopic));

    // Alarme: Taux d'erreur > 1%
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: 'FeatureFlags-HighErrorRate',
      alarmDescription: 'Error rate exceeds 1%',
      metric: new cloudwatch.MathExpression({
        expression: 'IF(requests > 0, (errors / requests) * 100, 0)',
        usingMetrics: {
          errors: http5xxMetric,
          requests: requestCountMetric,
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    errorRateAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
    errorRateAlarm.addOkAction(new actions.SnsAction(this.alarmTopic));

    // Alarme: CPU Read Service > 85%
    const readCpuAlarm = new cloudwatch.Alarm(this, 'ReadCPUAlarm', {
      alarmName: 'FeatureFlags-ReadService-HighCPU',
      alarmDescription: 'Read service CPU utilization > 85%',
      metric: readCpuMetric,
      threshold: 85,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    readCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // Alarme: Memory Read Service > 90%
    const readMemoryAlarm = new cloudwatch.Alarm(this, 'ReadMemoryAlarm', {
      alarmName: 'FeatureFlags-ReadService-HighMemory',
      alarmDescription: 'Read service memory utilization > 90%',
      metric: readMemoryMetric,
      threshold: 90,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    readMemoryAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // Alarme: CPU Management Service > 80%
    const managementCpuAlarm = new cloudwatch.Alarm(this, 'ManagementCPUAlarm', {
      alarmName: 'FeatureFlags-ManagementService-HighCPU',
      alarmDescription: 'Management service CPU utilization > 80%',
      metric: managementCpuMetric,
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    managementCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // Alarme: Zero healthy targets (service down)
    const unhealthyTargetsAlarm = new cloudwatch.Alarm(this, 'UnhealthyTargetsAlarm', {
      alarmName: 'FeatureFlags-UnhealthyTargets',
      alarmDescription: 'No healthy targets available',
      metric: props.alb.metricActiveConnectionCount({
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    unhealthyTargetsAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // ========================================
    // Dashboard Widgets
    // ========================================

    // Row 1: Overview
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown:
          '# 🚀 LaunchLayer - Feature Flags Platform\n\nReal-time monitoring of the platform health and performance.',
        width: 24,
        height: 2,
      }),
    );

    // Row 2: Key Metrics
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Requests (1h)',
        metrics: [requestCountMetric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Latency p50',
        metrics: [latencyP50Metric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Latency p99',
        metrics: [latencyP99Metric],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: '5xx Errors',
        metrics: [http5xxMetric],
        width: 6,
        height: 4,
      }),
    );

    // Row 3: Response Time Graph
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Response Time',
        left: [
          props.alb.metricTargetResponseTime({ statistic: 'p50', label: 'p50' }),
          props.alb.metricTargetResponseTime({ statistic: 'p90', label: 'p90' }),
          props.alb.metricTargetResponseTime({ statistic: 'p99', label: 'p99' }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Request Count',
        left: [requestCountMetric],
        width: 12,
        height: 6,
      }),
    );

    // Row 4: HTTP Status Codes
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'HTTP Status Codes',
        left: [
          http2xxMetric.with({ label: '2XX Success', color: '#2ca02c' }),
          http4xxMetric.with({ label: '4XX Client Error', color: '#ff7f0e' }),
          http5xxMetric.with({ label: '5XX Server Error', color: '#d62728' }),
        ],
        width: 24,
        height: 6,
      }),
    );

    // Row 5: ECS Services
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Management Service - CPU & Memory',
        left: [managementCpuMetric.with({ label: 'CPU %' })],
        right: [managementMemoryMetric.with({ label: 'Memory %' })],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Read Service - CPU & Memory',
        left: [readCpuMetric.with({ label: 'CPU %' })],
        right: [readMemoryMetric.with({ label: 'Memory %' })],
        width: 12,
        height: 6,
      }),
    );

    // Row 6: Alarm Status
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        alarms: [
          readLatencyAlarm,
          errorRateAlarm,
          readCpuAlarm,
          readMemoryAlarm,
          managementCpuAlarm,
        ],
        width: 24,
        height: 4,
      }),
    );

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: 'FeatureFlagsAlarmTopicArn',
    });
  }
}
