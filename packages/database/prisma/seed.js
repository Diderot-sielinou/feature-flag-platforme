import * as crypto from 'crypto';
import {
  PrismaClient,
  ProjectRole,
  EnvironmentType,
  FlagType,
  FlagLifecycle,
  FlagStatus,
  ApiKeyScope,
  AuditCategory,
  AuditSource,
  AuditStatus,
  AuditSeverity,
  ActorType,
} from '@prisma/client';
const prisma = new PrismaClient();
function generateApiKey() {
  const randomBytes = crypto.randomBytes(24);
  const key = `ll_${randomBytes.toString('base64url')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}
async function main() {
  console.log('🌱 Starting database seed...\n');
  console.log('👤 Creating admin user...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@launchlayer.io' },
    update: {},
    create: {
      cognitoId: 'cognito-admin-001',
      email: 'admin@launchlayer.io',
      firstName: 'Admin',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
      timezone: 'UTC',
      locale: 'en',
      preferences: {
        theme: 'dark',
        notifications: true,
      },
    },
  });
  console.log(`   ✅ Admin user created: ${adminUser.email}`);
  console.log('👤 Creating developer user...');
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@launchlayer.io' },
    update: {},
    create: {
      cognitoId: 'cognito-dev-001',
      email: 'dev@launchlayer.io',
      firstName: 'Developer',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  console.log(`   ✅ Developer user created: ${devUser.email}`);
  console.log('📁 Creating demo project...');
  const demoProject = await prisma.project.upsert({
    where: { key: 'demo-project' },
    update: {},
    create: {
      name: 'Demo Project',
      key: 'demo-project',
      description: 'A demonstration project with sample feature flags',
      ownerId: adminUser.id,
      status: 'ACTIVE',
      billingPlan: 'FREE',
      maxFlags: 100,
      currentFlagCount: 0,
      tags: ['demo', 'sample'],
      color: '#6366f1',
      settings: {
        defaultEnvironment: 'development',
        requireApproval: false,
      },
    },
  });
  console.log(`   ✅ Demo project created: ${demoProject.name}`);
  console.log('👥 Adding project members...');
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: demoProject.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      userId: adminUser.id,
      role: ProjectRole.OWNER,
      acceptedAt: new Date(),
    },
  });
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: demoProject.id,
        userId: devUser.id,
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      userId: devUser.id,
      role: ProjectRole.EDITOR,
      invitedBy: adminUser.id,
      acceptedAt: new Date(),
    },
  });
  console.log('   ✅ Project members added');
  console.log('🌍 Creating environments...');
  const environments = [
    {
      name: 'Development',
      key: 'development',
      type: EnvironmentType.DEVELOPMENT,
      protected: false,
      requireApproval: false,
      sortOrder: 0,
      color: '#22c55e',
    },
    {
      name: 'Staging',
      key: 'staging',
      type: EnvironmentType.STAGING,
      protected: false,
      requireApproval: false,
      sortOrder: 1,
      color: '#f59e0b',
    },
    {
      name: 'Production',
      key: 'production',
      type: EnvironmentType.PRODUCTION,
      protected: true,
      requireApproval: true,
      sortOrder: 2,
      color: '#ef4444',
    },
  ];
  const createdEnvironments = {};
  for (const env of environments) {
    const created = await prisma.environment.upsert({
      where: {
        projectId_key: {
          projectId: demoProject.id,
          key: env.key,
        },
      },
      update: {},
      create: {
        projectId: demoProject.id,
        name: env.name,
        key: env.key,
        type: env.type,
        protected: env.protected,
        requireApproval: env.requireApproval,
        sortOrder: env.sortOrder,
        color: env.color,
        active: true,
      },
    });
    createdEnvironments[env.key] = created;
    console.log(`   ✅ Environment created: ${env.name}`);
  }
  console.log('🔑 Creating API keys...');
  for (const [envKey, env] of Object.entries(createdEnvironments)) {
    const { key, hash } = generateApiKey();
    await prisma.apiKey.upsert({
      where: { key },
      update: {},
      create: {
        name: `${env.name} SDK Key`,
        key: key,
        keyHash: hash,
        envId: env.id,
        projectId: demoProject.id,
        scope: ApiKeyScope.READ_ONLY,
        createdBy: adminUser.id,
        rateLimit: 1000,
        active: true,
      },
    });
    console.log(`   ✅ API Key for ${env.name}: ${key}`);
  }
  console.log('🎯 Creating segments...');
  const betaUsersSegment = await prisma.segment.upsert({
    where: {
      projectId_key: {
        projectId: demoProject.id,
        key: 'beta-users',
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      name: 'Beta Users',
      key: 'beta-users',
      description: 'Users who opted into beta features',
      rules: {
        match: 'ALL',
        conditions: [
          { attribute: 'beta_optin', operator: 'EQ', value: true },
          { attribute: 'email_verified', operator: 'EQ', value: true },
        ],
      },
      color: '#8b5cf6',
      icon: 'flask',
      active: true,
      createdBy: adminUser.id,
    },
  });
  console.log(`   ✅ Segment created: ${betaUsersSegment.name}`);
  const premiumUsersSegment = await prisma.segment.upsert({
    where: {
      projectId_key: {
        projectId: demoProject.id,
        key: 'premium-users',
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      name: 'Premium Users',
      key: 'premium-users',
      description: 'Users with premium subscription',
      rules: {
        match: 'ANY',
        conditions: [
          { attribute: 'plan', operator: 'IN', value: ['pro', 'enterprise'] },
          { attribute: 'subscription_status', operator: 'EQ', value: 'active' },
        ],
      },
      color: '#f59e0b',
      icon: 'crown',
      active: true,
      createdBy: adminUser.id,
    },
  });
  console.log(`   ✅ Segment created: ${premiumUsersSegment.name}`);
  console.log('🏴 Creating feature flags...');
  const flags = [
    {
      key: 'new-dashboard',
      name: 'new_dashboard',
      title: 'New Dashboard',
      description: 'Enable the redesigned dashboard UI',
      type: FlagType.BOOLEAN,
      lifecycle: FlagLifecycle.PERMANENT,
      tags: ['ui', 'dashboard'],
      category: 'feature',
      states: {
        development: { enabled: true, defaultState: true },
        staging: { enabled: true, defaultState: true },
        production: { enabled: true, defaultState: false, rolloutPercentage: 25 },
      },
    },
    {
      key: 'dark-mode',
      name: 'dark_mode',
      title: 'Dark Mode',
      description: 'Enable dark mode theme',
      type: FlagType.BOOLEAN,
      lifecycle: FlagLifecycle.PERMANENT,
      tags: ['ui', 'theme'],
      category: 'feature',
      states: {
        development: { enabled: true, defaultState: true },
        staging: { enabled: true, defaultState: true },
        production: { enabled: true, defaultState: true },
      },
    },
    {
      key: 'checkout-v2',
      name: 'checkout_v2',
      title: 'Checkout V2',
      description: 'New checkout flow with improved UX',
      type: FlagType.BOOLEAN,
      lifecycle: FlagLifecycle.TEMPORARY,
      tags: ['checkout', 'experiment'],
      category: 'feature',
      temporary: true,
      states: {
        development: { enabled: true, defaultState: true },
        staging: { enabled: true, defaultState: true },
        production: { enabled: true, defaultState: false, rolloutPercentage: 10 },
      },
    },
    {
      key: 'pricing-experiment',
      name: 'pricing_experiment',
      title: 'Pricing Page Experiment',
      description: 'A/B test for pricing page layout',
      type: FlagType.MULTIVARIATE,
      lifecycle: FlagLifecycle.EXPERIMENT,
      tags: ['pricing', 'ab-test'],
      category: 'experiment',
      states: {
        development: { enabled: true, defaultState: true },
        staging: { enabled: true, defaultState: true },
        production: { enabled: true, defaultState: true },
      },
      variants: [
        {
          key: 'control',
          name: 'Control',
          value: { layout: 'horizontal', showAnnual: true },
          weight: 50,
        },
        {
          key: 'variant-a',
          name: 'Variant A',
          value: { layout: 'vertical', showAnnual: true },
          weight: 25,
        },
        {
          key: 'variant-b',
          name: 'Variant B',
          value: { layout: 'vertical', showAnnual: false },
          weight: 25,
        },
      ],
    },
    {
      key: 'maintenance-mode',
      name: 'maintenance_mode',
      title: 'Maintenance Mode',
      description: 'Enable maintenance mode for the platform',
      type: FlagType.BOOLEAN,
      lifecycle: FlagLifecycle.KILL_SWITCH,
      tags: ['operations', 'maintenance'],
      category: 'ops',
      states: {
        development: { enabled: true, defaultState: false },
        staging: { enabled: true, defaultState: false },
        production: { enabled: true, defaultState: false },
      },
    },
    {
      key: 'api-rate-limit',
      name: 'api_rate_limit',
      title: 'API Rate Limit',
      description: 'Configure API rate limiting value',
      type: FlagType.NUMBER,
      lifecycle: FlagLifecycle.OPERATIONAL,
      tags: ['api', 'performance'],
      category: 'ops',
      states: {
        development: { enabled: true, defaultState: true },
        staging: { enabled: true, defaultState: true },
        production: { enabled: true, defaultState: true },
      },
    },
  ];
  for (const flagData of flags) {
    const flag = await prisma.flag.upsert({
      where: {
        projectId_key: {
          projectId: demoProject.id,
          key: flagData.key,
        },
      },
      update: {},
      create: {
        projectId: demoProject.id,
        key: flagData.key,
        name: flagData.name,
        title: flagData.title,
        description: flagData.description,
        type: flagData.type,
        lifecycle: flagData.lifecycle,
        status: FlagStatus.ACTIVE,
        tags: flagData.tags,
        category: flagData.category,
        temporary: flagData.temporary ?? false,
        ownerId: adminUser.id,
      },
    });
    for (const [envKey, stateData] of Object.entries(flagData.states)) {
      const env = createdEnvironments[envKey];
      await prisma.flagEnvironmentState.upsert({
        where: {
          flagId_envId: {
            flagId: flag.id,
            envId: env.id,
          },
        },
        update: {},
        create: {
          flagId: flag.id,
          envId: env.id,
          enabled: stateData.enabled,
          defaultState: stateData.defaultState,
          rolloutPercentage: 100,
          rules: {},
          version: 1,
          fallbackValue: false,
          lastModifiedBy: adminUser.id,
        },
      });
    }
    if (flagData.variants) {
      for (let i = 0; i < flagData.variants.length; i++) {
        const variant = flagData.variants[i];
        await prisma.flagVariant.upsert({
          where: {
            flagId_key: {
              flagId: flag.id,
              key: variant.key,
            },
          },
          update: {},
          create: {
            flagId: flag.id,
            key: variant.key,
            name: variant.name,
            value: variant.value,
            weight: variant.weight,
            sortOrder: i,
            active: true,
          },
        });
      }
    }
    console.log(`   ✅ Flag created: ${flagData.title}`);
  }
  await prisma.project.update({
    where: { id: demoProject.id },
    data: { currentFlagCount: flags.length },
  });
  console.log('📝 Creating audit log entries...');
  await prisma.auditLog.createMany({
    data: [
      {
        projectId: demoProject.id,
        actorId: adminUser.id,
        actorType: ActorType.USER,
        action: 'project.created',
        category: AuditCategory.PROJECT_CHANGE,
        targetType: 'project',
        targetId: demoProject.id,
        targetName: demoProject.name,
        afterState: { name: demoProject.name, key: demoProject.key },
        source: AuditSource.WEB,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO,
      },
      {
        projectId: demoProject.id,
        actorId: adminUser.id,
        actorType: ActorType.USER,
        action: 'flag.created',
        category: AuditCategory.FLAG_CHANGE,
        targetType: 'flag',
        targetId: 'new-dashboard',
        targetName: 'New Dashboard',
        afterState: { key: 'new-dashboard', name: 'New Dashboard' },
        source: AuditSource.WEB,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO,
      },
      {
        projectId: demoProject.id,
        actorId: adminUser.id,
        actorType: ActorType.USER,
        action: 'member.invited',
        category: AuditCategory.USER_MANAGEMENT,
        targetType: 'user',
        targetId: devUser.id,
        targetName: devUser.email,
        afterState: { role: 'EDITOR', email: devUser.email },
        source: AuditSource.WEB,
        status: AuditStatus.SUCCESS,
        severity: AuditSeverity.INFO,
      },
    ],
    skipDuplicates: true,
  });
  console.log('   ✅ Audit log entries created');
  console.log('\n========================================');
  console.log('🎉 Seed completed successfully!');
  console.log('========================================');
  console.log(`\n📊 Summary:`);
  console.log(`   • Users: 2`);
  console.log(`   • Projects: 1`);
  console.log(`   • Environments: 3`);
  console.log(`   • Segments: 2`);
  console.log(`   • Flags: ${flags.length}`);
  console.log(`   • API Keys: 3`);
  console.log('\n💡 Login credentials:');
  console.log(`   Admin: admin@launchlayer.io`);
  console.log(`   Dev: dev@launchlayer.io`);
  console.log('\n⚠️  Note: API keys are displayed above. Save them securely!');
  console.log('\n');
}
main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
//# sourceMappingURL=seed.js.map
