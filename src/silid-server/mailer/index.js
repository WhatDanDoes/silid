'use strict';

let nodemailer = require('nodemailer');
let aws = require('aws-sdk');

module.exports = (function() {
  let env = process.env.NODE_ENV || 'development';
  let transport;

  if (env === 'staging') {
    transport = {
      service: 'gmail',
      auth: {
        user: process.env.NOREPLY_EMAIL,
        pass: process.env.NOREPLY_PASSWORD
      }
    };
  } else if (env === 'development') {
    transport = {
      port: 25,
      ignoreTLS: true
    };
  } else if (env === 'development_aws' || env === 'production') {
    // configure AWS SDK
    aws.config.loadFromPath('config/aws.json');
    transport = {
      SES: new aws.SES({
        apiVersion: '2010-12-01'
      })
    };
  } else {
    transport = require('nodemailer-mock-transport')({
      foo: 'bar'
    });
  }

  const transporter = nodemailer.createTransport(transport);

  return { transporter: transporter, transport: transport };
})();
