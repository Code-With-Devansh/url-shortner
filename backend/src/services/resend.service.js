import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmailVerificationMail = async (to, link) =>{
  const { data, error } = await resend.emails.send({
    from: "Pixel Mart <no-reply@pixel-mart.in>",
    to: [to],
    subject: 'Email Verification',
    html: `
  <h2>Email Verification</h2>
  <p>Click below to verify your email:</p>
  <a href="${link}">Verify Email</a>
`,
  });

  if (error) {
    throw new Error(error)
  }

};

