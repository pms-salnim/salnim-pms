
import type { Property, EmailSignatureSettings } from "../types/property";

/**
 * Ensures a URL has https:// prefix
 */
export const ensureHttps = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

/**
 * Formats WhatsApp URLs to wa.me format
 */
export const formatWhatsAppUrl = (input: string): string => {
  if (!input) return '';
  // Remove all non-numeric and + characters
  const number = input.replace(/[^0-9+]/g, '');
  // Ensure it starts with + for international format, otherwise assume domestic
  const formattedNumber = number.startsWith('+') ? number : `+${number}`;
  return `https://wa.me/${formattedNumber.replace(/^\+/, '')}`;
};

/**
 * Generates email signature HTML from signature settings
 */
export const generateSignatureHtml = (signatureSettings: EmailSignatureSettings | undefined): string => {
  if (!signatureSettings) {
    return '';
  }

  const {
    signatureName,
    signaturePropertyName,
    signaturePhone,
    signatureEmail,
    signatureAddress,
    signatureWebsite,
    signatureLogo,
    signatureSocialMedia,
  } = signatureSettings;

  // Return empty signature if no data is provided
  const hasSignatureData = signatureName || signaturePropertyName || signaturePhone || signatureEmail || signatureAddress || signatureWebsite || signatureLogo;
  if (!hasSignatureData) {
    return '';
  }

  const currentYear = new Date().getFullYear();

  // Simple social media icons (using Unicode emoji as fallback)
  const facebookSvg = '<img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;">';
  const instagramSvg = '<img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;">';
  const xSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle; opacity: 0.6; fill: currentColor;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.165-6.75-5.91 6.75h-3.308l7.73-8.835L.424 2.25h6.76l4.967 6.59L17.78 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  const whatsappSvg = '<img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;">';
  const linkedinSvg = '<img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" width="16" height="16" style="vertical-align: middle; opacity: 0.6;">';
  const tripadvisorSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle; opacity: 0.6; fill: currentColor;"><path d="M12 1.75c-5.66 0-10.25 4.59-10.25 10.25S6.34 22.25 12 22.25s10.25-4.59 10.25-10.25S17.66 1.75 12 1.75zm0 18.5c-4.55 0-8.25-3.7-8.25-8.25S7.45 3.75 12 3.75s8.25 3.7 8.25 8.25-3.7 8.25-8.25 8.25z"/></svg>';

  return `
    <div style="padding: 30px 40px; background-color: #fcfcfc; border-top: 1px solid #eeeeee; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; font-size: 14px; line-height: 1.6;">
      <!-- Contact & Social Bar -->
      <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; display: block; clear: both;">
        <!-- Left Side: Property Details -->
        <div style="float: left; width: 55%; text-align: left;">
          ${signaturePropertyName ? `<p style="margin: 0; font-size: 16px; color: #1a2b49; font-weight: bold;">${signaturePropertyName}</p>` : ''}
          ${signatureAddress ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;">${signatureAddress}</p>` : ''}
          
          <!-- Contact Details with Icons -->
          <div style="margin-top: 10px;">
            ${signaturePhone ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="tel:${signaturePhone.replace(/[^0-9+]/g, '')}" style="color: #666666; text-decoration: none;">📞 ${signaturePhone}</a></p>` : ''}
            ${signatureEmail ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="mailto:${signatureEmail}" style="color: #666666; text-decoration: none;">📧 ${signatureEmail}</a></p>` : ''}
            ${signatureWebsite ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;"><a href="${ensureHttps(signatureWebsite)}" style="color: #666666; text-decoration: none;">🌐 ${signatureWebsite}</a></p>` : ''}
          </div>
        </div>
        
        <!-- Right Side: Connect With Us -->
        <div style="float: right; width: 45%; text-align: right;">
          <p style="margin: 0; font-size: 10px; color: #888888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Connect With Us</p>
          <div style="margin-top: 10px;">
            ${signatureSocialMedia?.facebook ? `<a href="${ensureHttps(signatureSocialMedia.facebook)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${facebookSvg}</a>` : ''}
            ${signatureSocialMedia?.instagram ? `<a href="${ensureHttps(signatureSocialMedia.instagram)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${instagramSvg}</a>` : ''}
            ${signatureSocialMedia?.x ? `<a href="${ensureHttps(signatureSocialMedia.x)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${xSvg}</a>` : ''}
            ${signatureSocialMedia?.whatsapp ? `<a href="${formatWhatsAppUrl(signatureSocialMedia.whatsapp)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${whatsappSvg}</a>` : ''}
            ${signatureSocialMedia?.linkedin ? `<a href="${ensureHttps(signatureSocialMedia.linkedin)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${linkedinSvg}</a>` : ''}
            ${signatureSocialMedia?.tripadvisor ? `<a href="${ensureHttps(signatureSocialMedia.tripadvisor)}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin-left: 12px; width: 24px; height: 24px;">${tripadvisorSvg}</a>` : ''}
          </div>
        </div>
        <div style="clear: both;"></div>
      </div>

      <!-- Legal Notice -->
      <div style="margin-top: 20px; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 15px;">
        <p style="margin: 0; font-size: 10px; color: #999999; line-height: 1.6;">
          &copy; ${currentYear} ${signaturePropertyName || 'Our Hotel'}. All rights reserved.
        </p>
      </div>
    </div>
  `;
};

export const generateEmailHtml = (bodyContent: string, propertyData: Property): string => {
    const primaryColor = propertyData.invoiceCustomization?.primaryColor || '#003166';
    const logoUrl = propertyData.bookingPageSettings?.logoUrl || ''; // Use logo from booking settings
    const propertyName = propertyData.name || 'Your Property';
    const propertyAddress = propertyData.address || '';
    const currentYear = new Date().getFullYear();
    const formattedBody = bodyContent.replace(/\n/g, '<br />');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${propertyName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 20px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <!-- Header -->
              <tr>
                <td align="center" style="background-color: ${primaryColor}; padding: 20px;">
                  ${logoUrl 
                    ? `<img src="${logoUrl}" alt="${propertyName} Logo" style="max-width: 150px; max-height: 70px; border: 0;">`
                    : `<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${propertyName}</h1>`
                  }
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                  ${formattedBody}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0;">${propertyName}</p>
                  ${propertyAddress ? `<p style="margin: 5px 0 0 0;">${propertyAddress}</p>` : ''}
                  <p style="margin: 10px 0 0 0;">&copy; ${currentYear} ${propertyName}. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
};
