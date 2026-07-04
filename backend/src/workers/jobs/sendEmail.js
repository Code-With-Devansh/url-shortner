import config from "../../config/index.js";
import { sendEmailVerificationMail, sendpasswordResetMail } from "../../services/resend.service.js";

export const sendEmail = async({to, template, name, token})=>{
    if(template === 'verification-link')
      await sendEmailVerificationMail(
        name,
        to,
        config.app.baseUrl + `api/auth/verify-email/${token}`,
      );
    if (template === 'forgot-password')
      await sendpasswordResetMail(
        name,
        to,
        config.app.frontendUrl + `/auth/change-password/${token}`,
      );
}