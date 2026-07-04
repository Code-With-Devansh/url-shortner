import { Resend } from 'resend';
import { emailVerificationTemplate } from '../templates/EmailVerificationHtml.js';
import config from '../config/index.js';
import { forgotPasswordTemplate } from '../templates/ForgotPasswordHTML.js';

const resend = new Resend(config.email.resendApiKey);

export const sendEmailVerificationMail = async (name, email, link) =>{
  const { data, error } = await resend.emails.send({
    from: "Pixel Mart <no-reply@pixel-mart.in>",
    to: [email],
    subject: 'Email Verification',
    html: emailVerificationTemplate(name, email, link)
  });
  if (error) {
    throw new Error(error)
  }

};
export const sendpasswordResetMail = async (name, email, link) =>{
  const { data, error } = await resend.emails.send({
    from: "Pixel Mart <no-reply@pixel-mart.in>",
    to: [email],
    subject: 'Reset Password',
    html: forgotPasswordTemplate(name, email, link)
  });

  if (error) {
    throw new Error(error)
  }

};

