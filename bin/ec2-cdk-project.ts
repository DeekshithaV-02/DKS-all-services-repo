#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Ec2CdkProjectStack } from '../lib/ec2-cdk-project-stack';

const app = new cdk.App();
new Ec2CdkProjectStack(app, 'Ec2CdkProjectStackUSEast1', {
  env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    },
  });
   // Deploy to us-east-2
   /* new Ec2CdkProjectStack(app, 'Ec2CdkProjectStackUSEast2', {
     env: {
       account: process.env.CDK_DEFAULT_ACCOUNT,
       region: 'us-east-2',
     },
   });
 */