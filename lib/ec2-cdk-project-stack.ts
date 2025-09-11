import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class Ec2CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
     // Create VPC with public and private subnets (default 3 AZs)
   // 1. VPC
    // 1. VPC
    console.log('🚀 Starting EC2 + ALB + ASG + CW stack deployment');
 
    // 1. VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
    });
    console.log('✅ VPC created');
 
    // 2. Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSG', {
      vpc,
      description: 'Allow HTTP and SSH',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH');
    console.log('✅ Security Group created');
 
    // 3. Amazon Linux 2 AMI
    const ami = ec2.MachineImage.latestAmazonLinux();
    console.log('✅ Amazon Linux AMI selected');
 
    // 4. Auto Scaling Group
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
 
    // 5. Application Load Balancer
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
     //creating cloud watch
    // 6. CloudWatch Metric
    const cpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/EC2',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        AutoScalingGroupName: asg.autoScalingGroupName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });
 
    // 7. Alarm
    new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      metric: cpuMetric,
      threshold: 70,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Triggers if average CPU > 70% for 10 minutes',
    });
 
    console.log('✅ CloudWatch Alarm configured');
 
    // 8. Auto Scaling policies
    asg.scaleOnCpuUtilization('ScaleOnCPU', {
      targetUtilizationPercent: 50,
    });
 
    asg.scaleOnSchedule('ScaleInAtNight', {
      schedule: autoscaling.Schedule.cron({ hour: '2', minute: '0' }),
      desiredCapacity: 1,
    });
 
    console.log('✅ Auto Scaling policies configured');
    console.log('🎉 Stack setup complete');
  
    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'Ec2CdkProjectQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
