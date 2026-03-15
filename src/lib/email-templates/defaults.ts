/**
 * Default Email Template Contents
 * Contains HTML content, subject lines, and preheader text for all system email templates
 */

export const defaultEmailTemplateContents = {
  'reservation-inquiry': {
    subject: 'Room Availability & Pricing for Your Dates',
    preheaderText: 'Thank you for your inquiry - here are our available rooms and special rates',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff;margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ffffff; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: #003166; padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Availability Response</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you for your interest in <strong>{{property_name}}</strong>! We're delighted to help you plan your stay. Based on your inquiry, we have wonderful options available for your requested dates with special rates just for you.
            </p>

            <!-- Inquiry Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Your Inquiry Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Number of Nights</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_nights}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Number of Guests</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_guests}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Room Options -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Available Room Options</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Nightly Rate</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{nightly_rate}} {{currency}} per night</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Total for Stay</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Property Information -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Property Information</div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Address</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_address}}</td>
                        </tr>
                    </tbody></table>
                </div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Phone</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_phone}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">Ready to complete your booking?</p>
                <a href="[BOOKING_URL]" class="btn" style="background-color: #c5a059; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Book Your Stay Now</a>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>This rate is valid for <strong>48 hours</strong>. Booking after this period may result in different pricing.</li>
                <li>Booking confirmation requires a valid payment method.</li>
                <li>Our <strong>cancellation policy</strong> allows free cancellation up to 7 days before arrival.</li>
                <li>For special requests or group bookings, please contact us directly at {{property_phone}}</li>
            </ul>
        </td>
    </tr>

    <!-- Footer -->
    
</tbody></table>
    `.trim(),
  },

  'reservation-information': {
    subject: 'Your Reservation Details',
    preheaderText: 'Complete information about your reservation with all booking details',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(26, 43, 73); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Reservation Details</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Your reservation information for <strong>{{property_name}}</strong> has been recorded. Below you will find complete details of your booking.
            </p>

            <!-- Reservation Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Reservation Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Reference #</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}} at {{check_in_time}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}} at {{check_out_time}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Guests</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_guests}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Total Amount</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Location & Contact -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Location &amp; Contact</div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Address</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_address}}</td>
                        </tr>
                    </tbody></table>
                </div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Phone</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_phone}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">Need to make changes to your reservation?</p>
                <a href="{{property_website}}/guest-portal" class="btn" style="background-color: #c5a059; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Your Reservation</a>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Please keep this confirmation for your records.</li>
                <li>A valid photo ID and credit card are required at check-in.</li>
                <li><strong>Cancellation Policy:</strong> [CANCELLATION_POLICY_TEXT]</li>
                <li>For any modifications or special requests, contact us at {{property_phone}} or {{property_email}}</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'booking-confirmation': {
    subject: 'Your Booking is Confirmed!',
    preheaderText: 'Your reservation is confirmed and ready for your arrival',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(26, 43, 73); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Reservation Confirmed</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you for choosing <strong>{{property_name}}</strong>. We are delighted to confirm your upcoming stay. Below you will find your reservation details and check-in information.
            </p>

            <!-- Reservation Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Booking Information</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Confirmation #</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Guests</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_guests}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Location & Contact -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Location &amp; Contact</div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Address</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_address}}</td>
                        </tr>
                    </tbody></table>
                </div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Phone</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_phone}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">Need to make changes or add special requests?</p>
                <a href="[MANAGE_BOOKING_URL]" class="btn" style="background-color: #c5a059; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Manage My Reservation</a>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>A valid photo ID and credit card are required at check-in.</li>
                <li><strong>Cancellation Policy:</strong> [CANCELLATION_POLICY_TEXT]</li>
                <li>Parking is available [PARKING_DETAILS].</li>
            </ul>
        </td>
    </tr>
</tbody></table>
    `.trim(),
  },

  'reservation-modification': {
    subject: 'Your Reservation Has Been Updated',
    preheaderText: 'Your booking details have been modified as requested',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(255, 152, 0); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Reservation Modified</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Your reservation at <strong>{{property_name}}</strong> has been successfully updated. Below you will find your updated booking details.
            </p>

            <!-- Update Notice -->
            <div class="update-notice" style="background-color: #fff8f0; border-left: 4px solid #ff9800; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0; color: #e65100; font-weight: bold;">⚠ Changes to Your Reservation</p>
                <p style="margin: 8px 0 0 0; color: #bf360c; font-size: 13px;">Please review the updated details below to ensure everything is correct.</p>
            </div>

            <!-- Updated Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Updated Reservation Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Reference #</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Number of Nights</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_nights}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">New Total</td>
                            <td width="60%" style="font-size: 14px; color: rgb(197, 160, 89); font-weight: bold;">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Location & Contact -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Location &amp; Contact</div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Address</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_address}}</td>
                        </tr>
                    </tbody></table>
                </div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Phone</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_phone}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">Need to make further changes?</p>
                <a href="{{property_website}}/guest-portal" class="btn" style="background-color: #c5a059; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Manage Your Reservation</a>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>If you did not request these changes, please contact us immediately.</li>
                <li>Please review your updated reservation carefully to ensure accuracy.</li>
                <li>Any additional charges or refunds will be processed to your original payment method.</li>
                <li>For questions or concerns, contact us at {{property_phone}} or {{property_email}}</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'reservation-cancellation': {
    subject: 'Your Reservation Has Been Cancelled',
    preheaderText: 'Cancellation confirmation and refund details for your reservation',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(220, 53, 69); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Reservation Cancelled</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                We acknowledge that your reservation with <strong>{{property_name}}</strong> has been cancelled as requested. Below you will find the cancellation details and information about your refund.
            </p>

            <!-- Cancellation Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #dc3545;">
                <div class="details-header" style="background-color: #fff5f5; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #721c24; border-bottom: 1px solid #e0e0e0;">Cancellation Information</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Confirmation #</td>
                            <td width="60%" style="font-size: 14px; color: rgb(220, 53, 69); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Original Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Number of Nights</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_nights}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Refund Information -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Refund Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Original Amount</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Refund Amount</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51); font-weight: bold;">{{{refund_amount}}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Processing Time</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">5-7 business days</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Important Info -->
            <div style="padding: 20px; background-color: #f9f9f9; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
                <h4 style="color: #1a2b49; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Important Information</h4>
                <p style="margin: 0; font-size: 13px; color: #666;">The refund will be credited to your original payment method. Depending on your bank or credit card provider, it may take an additional 1-2 business days to appear in your account.</p>
            </div>

            <!-- Contact Info -->
            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">Questions about your cancellation?</p>
                <a href="mailto:support@{{property_domain}}" class="btn" style="background-color: #6c757d; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 14px;">Contact Support</a>
            </div>
        </td>
    </tr>
</tbody></table>
    `.trim(),
  },

  'check-in-instructions': {
    subject: 'Get Ready for Your Arrival - Check-in Instructions Inside',
    preheaderText: 'Everything you need to know before your arrival',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(76, 175, 80); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Welcome & Check-in</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                We're excited to welcome you to <strong>{{property_name}}</strong>! Your arrival is coming soon. Below you'll find everything you need to know to ensure a smooth and pleasant check-in experience.
            </p>

            <!-- Arrival Details Table -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Arrival Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in Time</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_time}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Property Information -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Property Information</div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Address</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_address}}</td>
                        </tr>
                    </tbody></table>
                </div>
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Contact</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_phone}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Digital Check-in Notice -->
            <div class="checkin-notice" style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #2e7d32; font-weight: bold;">✓ Digital Check-in Available</p>
                <p style="margin: 0; color: #558b2f; font-size: 13px;">Skip the front desk! Complete your check-in online through our guest portal before arrival for a faster experience.</p>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <a href="{{property_website}}/guest-portal" class="btn" style="background-color: #4caf50; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Complete Digital Check-in</a>
            </div>

            <!-- What to Bring -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">What to Bring</div>
                <div style="padding: 20px;">
                    <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
                        <li style="margin-bottom: 8px;">Valid photo ID (required)</li>
                        <li style="margin-bottom: 8px;">Payment method for incidentals or additional charges</li>
                        <li style="margin-bottom: 8px;">Any special requests documentation or confirmations</li>
                        <li>Credit card authorization may be required at check-in</li>
                    </ul>
                </div>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Standard check-in time is {{check_in_time}}. Early check-in may be available upon request.</li>
                <li>Please contact us in advance if you expect to arrive late or have special needs.</li>
                <li>Our guest portal contains important property information, amenities, and house rules.</li>
                <li>The check-out time is {{check_out_time}} on {{check_out_date}}.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'checked-in-welcome': {
    subject: 'Welcome! Everything You Need is in the Guest Portal',
    preheaderText: 'Discover all amenities, services, and features available to you',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(76, 175, 80); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Welcome to Your Room</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Hello {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you for choosing <strong>{{property_name}}</strong>! We're delighted to have you with us. We've prepared everything you need to enjoy a wonderful stay. Your dedicated guest portal is your gateway to all our services and amenities.
            </p>

            <!-- Room Information Box -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #4caf50;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Your Room Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Guest ID</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Portal Features -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Guest Portal Features</div>
                <div style="padding: 20px;">
                    <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
                        <li style="margin-bottom: 10px;">📍 Amenities & Services Directory</li>
                        <li style="margin-bottom: 10px;">📡 WiFi Passwords & Setup Instructions</li>
                        <li style="margin-bottom: 10px;">📋 House Rules & Property Policies</li>
                        <li style="margin-bottom: 10px;">🏙️ Local Attractions & Recommendations</li>
                        <li style="margin-bottom: 10px;">🍽️ Restaurant Reservations & Dining</li>
                        <li style="margin-bottom: 10px;">🛎️ Room Service & Special Requests</li>
                        <li style="margin-bottom: 0;">💬 24/7 Concierge Chat Support</li>
                    </ul>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <a href="{{property_website}}/guest-portal" class="btn" style="background-color: #4caf50; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Guest Portal</a>
            </div>

            <!-- Support Information -->
            <div class="support-box" style="background-color: #f0f8ff; border: 1px solid #b3e5fc; border-radius: 8px; padding: 15px 20px; margin: 30px 0;">
                <p style="margin: 0 0 8px 0; color: #01579b; font-weight: bold;">🎯 Need Assistance?</p>
                <p style="margin: 0; color: #0277bd; font-size: 13px;">Our concierge team is available 24/7 to help. Reach us at <strong>{{property_phone}}</strong> or through the guest portal chat feature for instant support.</p>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Helpful Tips</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Check the guest portal first for quick answers to common questions.</li>
                <li>WiFi credentials are available in your guest portal and in-room materials.</li>
                <li>For emergency situations, use the emergency contact numbers posted in your room.</li>
                <li>Local restaurant and activity recommendations are updated regularly in your portal.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'check-out-review': {
    subject: 'Thank You for Your Stay - We\'d Love Your Feedback',
    preheaderText: 'Your feedback helps us improve and we\'d love to hear from you',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(156, 39, 176); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Thank You for Visiting</h1>
        </td>
    </tr>

    <!-- Welcome Message -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you so much for choosing <strong>{{property_name}}</strong> for your recent stay. We truly appreciate your visit and hope you had a wonderful experience. Your feedback is invaluable as we continuously strive to improve our services.
            </p>

            <!-- Stay Summary -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Your Stay Summary</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Booking Reference</td>
                            <td width="60%" style="font-size: 14px; color: rgb(156, 39, 176); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Feedback Request -->
            <div class="feedback-notice" style="background-color: #f3e5f5; border-left: 4px solid #9c27b0; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #6a1b9a; font-weight: bold;">⭐ We'd Love Your Feedback</p>
                <p style="margin: 0; color: #8e24aa; font-size: 13px;">Your insights help us deliver exceptional experiences to all our guests. Please share your honest feedback about your stay.</p>
            </div>

            <!-- Review Categories -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">What We'd Like to Hear About</div>
                <div style="padding: 20px;">
                    <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
                        <li style="margin-bottom: 10px;">✓ Room cleanliness, comfort, and amenities</li>
                        <li style="margin-bottom: 10px;">✓ Staff friendliness, professionalism, and helpfulness</li>
                        <li style="margin-bottom: 10px;">✓ Facilities, services, and overall atmosphere</li>
                        <li style="margin-bottom: 0;">✓ Overall experience and value</li>
                    </ul>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <p style="font-size: 14px; color: #666666; margin-bottom: 15px;">It only takes 2-3 minutes to share your experience:</p>
                <a href="{{property_website}}/reviews" class="btn" style="background-color: #9c27b0; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Leave a Review</a>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Why Your Review Matters</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Your feedback helps us identify what we do well and where we can improve.</li>
                <li>Reviews help other guests make informed decisions about their stay.</li>
                <li>We carefully read and consider all feedback to enhance future experiences.</li>
                <li>Honest reviews—both positive and constructive—are greatly appreciated.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'invoice-receipt': {
    subject: 'Your Invoice / Receipt from {{property_name}}',
    preheaderText: 'Payment details and receipt for your reservation',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(0, 150, 136); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Invoice / Receipt</h1>
        </td>
    </tr>

    <!-- Content -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Dear {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you for your reservation at <strong>{{property_name}}</strong>. Below is your complete invoice and payment details for your records.
            </p>

            <!-- Reservation Details -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Reservation Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Booking ID</td>
                            <td width="60%" style="font-size: 14px; color: rgb(0, 150, 136); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Property</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{property_name}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Room Type</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{room_type}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Number of Nights</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{number_of_nights}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Payment Summary -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Payment Summary</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Total Amount</td>
                            <td width="60%" style="font-size: 14px; color: rgb(0, 150, 136); font-weight: bold;">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Amount Paid</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{paid_amount}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Outstanding Balance</td>
                            <td width="60%" style="font-size: 14px; color: rgb(211, 47, 47); font-weight: bold;">{{{remaining_amount}}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Payment Status Notice -->
            <div class="payment-notice" style="background-color: #e0f2f1; border-left: 4px solid #009688; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0; color: #00695c; font-weight: bold;">💳 Payment Status</p>
                <p style="margin: 8px 0 0 0; color: #00897b; font-size: 13px;">This invoice is for your records. If you have an outstanding balance, please arrange payment at your earliest convenience.</p>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Invoice Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>This invoice is issued upon reservation confirmation.</li>
                <li>Payment terms and conditions are outlined in your reservation agreement.</li>
                <li>If you have an outstanding balance, please contact us to arrange payment.</li>
                <li>All charges are in {{currency}} unless otherwise indicated.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'payment-confirmation': {
    subject: 'Payment Received - Thank You!',
    preheaderText: 'Your payment has been successfully processed',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(0, 150, 136); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">✓ Payment Received</h1>
        </td>
    </tr>

    <!-- Content -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Hello {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Thank you! Your payment has been successfully processed and your reservation is now confirmed. Below are your payment confirmation details.
            </p>

            <!-- Payment Confirmation Details -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #009688;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Payment Confirmation</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Booking ID</td>
                            <td width="60%" style="font-size: 14px; color: rgb(0, 150, 136); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Amount Paid</td>
                            <td width="60%" style="font-size: 14px; color: rgb(0, 150, 136); font-weight: bold;">{{paid_amount}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Payment Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">Today</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Reservation Summary -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Reservation Summary</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-out</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_out_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Total Reservation</td>
                            <td width="60%" style="font-size: 14px; color: rgb(0, 150, 136); font-weight: bold;">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Success Notice -->
            <div class="success-notice" style="background-color: #e0f2f1; border-left: 4px solid #009688; padding: 15px 20px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #00695c; font-weight: bold;">✓ Confirmation Sent</p>
                <p style="margin: 0; color: #00897b; font-size: 13px;">Your reservation is confirmed and secured. A detailed invoice has been attached to this email for your records.</p>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">What Happens Next</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Your reservation is confirmed as of today.</li>
                <li>Check-in instructions will be sent 48 hours before arrival.</li>
                <li>You can manage your reservation anytime in the guest portal.</li>
                <li>Contact us immediately if you need to make any changes.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'payment-error': {
    subject: 'Payment Could Not Be Processed - Action Required',
    preheaderText: 'There was an issue processing your payment. Please review and try again.',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(220, 53, 69); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Payment Failed</h1>
        </td>
    </tr>

    <!-- Content -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Hello {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                Unfortunately, we were unable to process your payment for your reservation at <strong>{{property_name}}</strong>. Below are the details and steps you can take to resolve this issue.
            </p>

            <!-- Payment Failed Details -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #dc3545;">
                <div class="details-header" style="background-color: #fff5f5; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #721c24; border-bottom: 1px solid #e0e0e0;">Payment Details</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Booking ID</td>
                            <td width="60%" style="font-size: 14px; color: rgb(220, 53, 69); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Amount</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{total_price}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Status</td>
                            <td width="60%" style="font-size: 14px; color: rgb(220, 53, 69); font-weight: bold;">Failed - Action Required</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Failure Reasons -->
            <div class="reasons-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Possible Reasons</div>
                <div style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; color: #666666; font-weight: bold; font-size: 13px;">The payment method declined the transaction. This could be due to:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
                        <li style="margin-bottom: 8px;">Insufficient funds in the account</li>
                        <li style="margin-bottom: 8px;">Expired or invalid card details</li>
                        <li style="margin-bottom: 8px;">Incorrect card information (CVV, address)</li>
                        <li style="margin-bottom: 8px;">Security restrictions or fraud detection by your bank</li>
                        <li>Card limit exceeded or transaction blocked by issuer</li>
                    </ul>
                </div>
            </div>

            <!-- What to Do -->
            <div class="action-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">Next Steps</div>
                <div style="padding: 20px;">
                    <ol style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                        <li style="margin-bottom: 8px;">Verify your payment method details are correct</li>
                        <li style="margin-bottom: 8px;">Try a different payment method if available</li>
                        <li style="margin-bottom: 8px;">Contact your bank to authorize the transaction</li>
                        <li>Reach out to our team for alternative payment options</li>
                    </ol>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <a href="{{property_website}}/payment" class="btn" style="background-color: #dc3545; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Try Payment Again</a>
            </div>

            <!-- Support Notice -->
            <div class="support-box" style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px 20px; margin: 30px 0;">
                <p style="margin: 0 0 8px 0; color: #856404; font-weight: bold;">🆘 Need Immediate Help?</p>
                <p style="margin: 0; color: #856404; font-size: 13px;">Our support team is available 24/7 to assist with payment issues. We can help you resolve this quickly and secure your reservation.</p>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Your reservation is currently on hold while we await payment.</li>
                <li>Please resolve this payment issue as soon as possible to secure your booking.</li>
                <li>Your reservation will be automatically cancelled if payment is not received within 24 hours.</li>
                <li>Contact us immediately if you need alternative payment arrangements.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },

  'late-payment-reminder': {
    subject: 'Friendly Reminder: Outstanding Payment Due',
    preheaderText: 'Please settle your overdue balance to secure your reservation',
    htmlContent: `
<table class="main" role="presentation" style="background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 100%; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; border-radius: 0px; overflow: hidden; border-collapse: collapse !important;">
    <!-- Header -->
    <tbody><tr>
        <td class="header" style="background-color: rgb(255, 152, 0); padding: 40px 20px; text-align: center; color: rgb(255, 255, 255);">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{{property_logo}}" alt="{{property_name}} Logo" class="logo" style="max-width: 180px; height: auto; display: inline-block; margin: 0 auto; border: 0; line-height: 100%; outline: none; text-decoration: none;">
            </div>
            <h1 class="hero-title" style="font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Payment Reminder</h1>
        </td>
    </tr>

    <!-- Content -->
    <tr>
        <td class="content" style="padding: 30px 40px;">
            <p class="greeting" style="font-size: 18px; margin-bottom: 10px;">Hello {{guest_name}},</p>
            <p class="intro-text" style="line-height: 1.6; color: #666666; margin-bottom: 30px;">
                We noticed that your payment for your reservation at <strong>{{property_name}}</strong> is overdue. To ensure your reservation remains confirmed and you can enjoy your stay as planned, please settle the outstanding balance as soon as possible.
            </p>

            <!-- Outstanding Balance -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ff9800;">
                <div class="details-header" style="background-color: #fff8f0; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #e65100; border-bottom: 1px solid #e0e0e0;">Outstanding Balance</div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Booking ID</td>
                            <td width="60%" style="font-size: 14px; color: rgb(255, 152, 0); font-weight: bold;">{{reservation_code}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Amount Due</td>
                            <td width="60%" style="font-size: 14px; color: rgb(211, 47, 47); font-weight: bold;">{{{remaining_amount}}} {{currency}}</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: 1px solid #f1f1f1;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Due Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(211, 47, 47); font-weight: bold;">Immediately</td>
                        </tr>
                    </tbody></table>
                </div>
                
                <div class="details-row" style="padding: 15px 20px; border-bottom: none;">
                    <table width="100%" style="border-collapse: collapse;">
                        <tbody><tr>
                            <td width="40%" style="font-weight: bold; color: rgb(102, 102, 102); font-size: 14px;">Check-in Date</td>
                            <td width="60%" style="font-size: 14px; color: rgb(51, 51, 51);">{{check_in_date}}</td>
                        </tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Payment Methods -->
            <div class="details-box" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <div class="details-header" style="background-color: #f1f1f1; padding: 12px 20px; font-weight: bold; font-size: 14px; text-transform: uppercase; color: #1a2b49; border-bottom: 1px solid #e0e0e0;">How to Pay</div>
                <div style="padding: 20px;">
                    <ol style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                        <li style="margin-bottom: 8px;">Visit our secure online payment portal (fastest option)</li>
                        <li style="margin-bottom: 8px;">Call us at <strong>{{property_phone}}</strong> to pay by phone</li>
                        <li style="margin-bottom: 8px;">Visit our property reception desk in person</li>
                        <li>Wire transfer available upon request</li>
                    </ol>
                </div>
            </div>

            <div class="cta-container" style="text-align: center; padding: 20px 0;">
                <a href="{{property_website}}/payment" class="btn" style="background-color: #ff9800; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Pay Outstanding Balance Now</a>
            </div>

            <!-- Urgent Warning -->
            <div class="warning-box" style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px 20px; margin: 30px 0;">
                <p style="margin: 0 0 8px 0; color: #856404; font-weight: bold;">⚠️ Important Notice</p>
                <p style="margin: 0; color: #856404; font-size: 13px;">Reservations with outstanding balances may be subject to automatic cancellation if payment is not received before your check-in date. Please settle this immediately to maintain your booking.</p>
            </div>
        </td>
    </tr>

    <!-- Important Info -->
    <tr>
        <td style="padding: 20px 40px 30px; font-size: 13px; line-height: 1.6; color: rgb(102, 102, 102); border-top: 1px solid rgb(238, 238, 238);">
            <h4 style="color: #1a2b49; margin-bottom: 10px; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-top: 0;">
                <li>Payment is required to finalize your reservation.</li>
                <li>Your check-in access may be restricted if payment is not completed.</li>
                <li>All outstanding charges must be settled before arrival date.</li>
                <li>Contact us immediately to discuss payment arrangements or concerns.</li>
            </ul>
        </td>
    </tr>

</tbody></table>
    `.trim(),
  },
};

export type EmailTemplateId = keyof typeof defaultEmailTemplateContents;
