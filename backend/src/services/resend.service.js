import { Resend } from 'resend';
import { emailVerificationTemplate } from '../templates/EmailVerificationHtml.js';

const resend = new Resend(process.env.RESEND_API_KEY);

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
export const sendpasswordResetMail = async (to, link) =>{
  const { data, error } = await resend.emails.send({
    from: "Pixel Mart <no-reply@pixel-mart.in>",
    to: [to],
    subject: 'Reset Password',
    html: `
  <h2>Reset Password</h2>
  <p>Click below to verify your email:</p>
  <a href="${link}">Verify Email</a>
`,
  });

  if (error) {
    throw new Error(error)
  }

};

