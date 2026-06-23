import { sendEmailVerificationMail } from "../../services/resend.service.js";

export const sendEmail = async({to, template, name, token})=>{
    if(template === 'verification-link')
      await sendEmailVerificationMail(
        name,
        to,
        process.env.BASE_URL + `api/auth/verify-email/${token}`,
      );
}