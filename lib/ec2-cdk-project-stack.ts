import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as s3 from 'aws-cdk-lib/aws-s3'; // ✅ ADDED: S3 module import

export class Ec2CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log('🚀 Starting EC2 + ALB + ASG + CW stack deployment');

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
    });
    console.log('✅ VPC created');

    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSG', {
      vpc,
      description: 'Allow HTTP and SSH',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH');
    console.log('✅ Security Group created');

    const ami = ec2.MachineImage.latestAmazonLinux();
    console.log('✅ Amazon Linux AMI selected');

    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ami,
      minCapacity: 1,
      maxCapacity: 3,
      desiredCapacity: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup,
    });

    asg.addUserData(
      'yum install -y httpd',
      'systemctl enable httpd',
      'systemctl start httpd',
      'echo "<h1>Deployed via CDK</h1>" > /var/www/html/index.html'
    );
    console.log('✅ Auto Scaling Group created and configured');

    const lb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener('Listener', {
      port: 80,
      open: true,
    });

    listener.addTargets('TargetGroup', {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
    });

    console.log('✅ Application Load Balancer created');

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: lb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    const cpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/EC2',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        AutoScalingGroupName: asg.autoScalingGroupName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      metric: cpuMetric,
      threshold: 70,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Triggers if average CPU > 70% for 10 minutes',
    });

    console.log('✅ CloudWatch Alarm configured');

    asg.scaleOnCpuUtilization('ScaleOnCPU', {
      targetUtilizationPercent: 50,
    });

    asg.scaleOnSchedule('ScaleInAtNight', {
      schedule: autoscaling.Schedule.cron({ hour: '2', minute: '0' }),
      desiredCapacity: 1,
    });

    console.log('✅ Auto Scaling policies configured');

    // ✅ ✅ ✅ NEWLY ADDED ✅ ✅ ✅
    // 📦 10. Create an S3 Bucket
    const bucket = new s3.Bucket(this, 'MyTestBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for dev/testing — don't use in prod
      autoDeleteObjects: true,
    });

    console.log('✅ S3 Bucket created');

    // Optional output
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    console.log('🎉 Stack setup complete');
  }
}