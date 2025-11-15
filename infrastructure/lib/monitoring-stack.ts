import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  managementService: ecs.FargateService;
  readService: ecs.FargateService;
  alb: elbv2.ApplicationLoadBalancer;
  alarmEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'Feature Flags Alarms',
    });

    alarmTopic.addSubscription(new subscriptions.EmailSubscription(props.alarmEmail));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'FeatureFlagsDashboard', {
      dashboardName: 'FeatureFlags-Production',
    });

    // Read API Latency Alarm (p99 > 50ms)
    const readLatencyAlarm = new cloudwatch.Alarm(this, 'ReadLatencyAlarm', {
      metric: props.alb.metricTargetResponseTime({
        statistic: 'p99',
      }),
      threshold: 0.05, // 50ms in seconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Read API p99 latency exceeds 50ms',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    readLatencyAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Error Rate Alarm (> 1%)
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      metric: new cloudwatch.MathExpression({
        expression: '(errors / requests) * 100',
        usingMetrics: {
          errors: props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
          requests: props.alb.metricRequestCount(),
        },
      }),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Error rate exceeds 1%',
    });

    errorRateAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // CPU Utilization Alarm
    const cpuAlarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      metric: props.readService.metricCpuUtilization(),
      threshold: 85,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Read service CPU utilization > 85%',
    });

    cpuAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Memory Utilization Alarm
    const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: props.readService.metricMemoryUtilization(),
      threshold: 90,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Read service memory utilization > 90%',
    });

    memoryAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Dashboard Widgets
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Response Time (p50, p99)',
        left: [
          props.alb.metricTargetResponseTime({
            statistic: 'p50',
            label: 'p50',
          }),
          props.alb.metricTargetResponseTime({
            statistic: 'p99',
            label: 'p99',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Request Count',
        left: [props.alb.metricRequestCount()],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'HTTP Status Codes',
        left: [
          props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_2XX_COUNT, {
            label: '2XX',
          }),
          props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_4XX_COUNT, {
            label: '4XX',
          }),
          props.alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
            label: '5XX',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Service CPU & Memory',
        left: [
          props.readService.metricCpuUtilization({ label: 'Read CPU' }),
          props.managementService.metricCpuUtilization({ label: 'Mgmt CPU' }),
        ],
        right: [
          props.readService.metricMemoryUtilization({ label: 'Read Memory' }),
          props.managementService.metricMemoryUtilization({ label: 'Mgmt Memory' }),
        ],
      }),
    );

    // Outputs
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
    });
  }
}
