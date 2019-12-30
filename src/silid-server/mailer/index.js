'use strict';

const nodemailer = require('nodemailer');

module.exports = function() {
  let env = process.env.NODE_ENV || 'development';
  let transport;

  if (env === 'production' || env === 'staging') {
    transport = {
      service: 'gmail',
      auth: {
        user: process.env.NOREPLY_EMAIL,
        pass: process.env.NOREPLY_PASSWORD
      }
    };
  }
  else if (env === 'development') {
    transport = {
      port: 25,
      ignoreTLS: true
    };
  }
  else {
    transport = require('nodemailer-mock-transport')({
      foo: 'bar'
    });
  }

  const transporter = nodemailer.createTransport(transport);
 
  return { transporter: transporter, transport: transport };
}();
