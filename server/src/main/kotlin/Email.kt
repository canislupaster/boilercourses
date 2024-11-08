package com.boilerclasses

data class EmailAvailability(val open: Int, val total: Int, val section: Schema.Section, val course: Schema.CourseId, val term: String)

data class EmailData(
    val rootUrl: String,
    val email: String,
    val qparams: String,
    val name: String
) {
    fun unsubscribe() = "$rootUrl/unsubscribe?$qparams"
    fun verify() = "$rootUrl/verify?$qparams"
}

data class AvailabilityEmailData(
    val email: EmailData,
    val courses: List<Schema.CourseId>,
    val availability: List<EmailAvailability>
)

fun email(data: AvailabilityEmailData): String {
    fun courseLink(c: Schema.CourseId)=
        "<a href=\"${data.email.rootUrl}/course/${c.id}\" style=\"color: #3b3b3b\" >${
            formatCourse(c.course.subject, c.course.course)
        }</a>"

    val formattedCourses = data.courses.map {courseLink(it)}

    return """
    <!doctype html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <title>
    
        </title>
        <!--[if !mso]><!-->
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <!--<![endif]-->
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style type="text/css">
          #outlook a { padding:0; }
          body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
          table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
          img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
          p { display:block;margin:13px 0; }
        </style>
        <!--[if mso]>
        <noscript>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]-->
        <!--[if lte mso 11]>
        <style type="text/css">
          .mj-outlook-group-fix { width:100% !important; }
        </style>
        <![endif]-->
    
    
        <style type="text/css">
          @media only screen and (min-width:480px) {
            .mj-column-per-100 { width:100% !important; max-width: 100%; }
          }
        </style>
        <style media="screen and (min-width:480px)">
          .moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }
        </style>
    
    
        <style type="text/css">
    
    
    
        @media only screen and (max-width:480px) {
          table.mj-full-width-mobile { width: 100% !important; }
          td.mj-full-width-mobile { width: auto !important; }
        }
    
        </style>
        <style type="text/css">
        @import url('https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
    
          .highlight {
            background-color: #ffc74f;
            color: #000;
            padding: 0 5px;
            border-radius: 3px;
          }
    
          .list-item {
            margin-bottom: 15px;
          }
        </style>
    
      </head>
      <body style="word-spacing:normal;background-color:#f4f4f5;">
    
    
          <div
             style="background-color:#f4f4f5;"
          >
            <!-- Logo and Header -->
    
          <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;"
          >
            <tbody>
              <tr>
                <td  style="width:120px;">
    
          <img
             alt="BoilerCourses" height="auto" src="${data.email.rootUrl}/icon.svg" style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;" width="120"
          />
    
                </td>
              </tr>
            </tbody>
          </table>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Chivo, Arial, sans-serif;font-size:40px;font-weight:900;line-height:1;text-align:center;color:#000000;"
          >BoilerCourses</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:20px;line-height:1;text-align:center;color:#000000;"
          >Availability in ${
            if (formattedCourses.size >= 2)
                "${formattedCourses.dropLast(1).joinToString(", ")} and ${formattedCourses.last()}"
            else formattedCourses.first()
        }</div>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:20px;line-height:1;text-align:left;color:#000000;"
          >Hello ${data.email.name},</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#000000;"
          >The following sections you are subscribed to have availability:</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#000000;"
          ><ul>
                ${data.availability.joinToString("\n") {
        "<li class=\"list-item\">${courseLink(it.course)}, Section ${it.section.section.trimStart { x->x=='0' }} (${formatTerm(it.term)}): <span class=\"highlight\">${it.open}</span> of <span class=\"highlight\" >${it.total}</span> seats available</li>"
    }}
              </ul></div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#000000;"
          >We're letting you know because you, or someone with access to your Purdue Microsoft account, has registered you for updates relating to these courses or sections. To unregister for these updates, <a href="${data.email.rootUrl}/notifications" >manage your notifications</a> on BoilerCourses.</div>
    
                    </td>
                  </tr>
                <!-- Button -->
                  <tr>
                    <td
                       align="center" vertical-align="middle" style="font-size:0px;padding:12px 25px;word-break:break-word;"
                    >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;"
          >
            <tbody>
              <tr>
                <td
                   align="center" bgcolor="#e5e7eb" role="presentation" style="border:1px solid #737373;border-radius:6px;cursor:auto;mso-padding-alt:10px 25px;background:#e5e7eb;" valign="middle"
                >
                  <a
                     href="${data.email.rootUrl}/notifications" style="display:inline-block;background:#e5e7eb;color:#000000;font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:normal;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:10px 25px;mso-padding-alt:0px;border-radius:6px;" target="_blank"
                  >
                    Notification settings
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><![endif]-->
    
        <!-- Footer -->
    
          <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:12px;line-height:1;text-align:center;color:#6b7280;"
          >Sent from BoilerCourses to ${data.email.email}. Don't want to receive any more emails?</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:12px;line-height:1;text-align:center;color:#000000;"
          ><a href="${data.email.unsubscribe()}" style="color: #993128" >
             Permanently unsubscribe from all future emails from BoilerCourses
            </a></div>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><![endif]-->
    
    
          </div>
    
      </body>
    </html>
""".trimIndent()
}

data class VerifyEmailData(
    val email: EmailData,
    //oops
)

fun verifyEmail(data: VerifyEmailData) = """
    <!doctype html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <title>
    
        </title>
        <!--[if !mso]><!-->
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <!--<![endif]-->
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style type="text/css">
          #outlook a { padding:0; }
          body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
          table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
          img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
          p { display:block;margin:13px 0; }
        </style>
        <!--[if mso]>
        <noscript>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]-->
        <!--[if lte mso 11]>
        <style type="text/css">
          .mj-outlook-group-fix { width:100% !important; }
        </style>
        <![endif]-->
    
    
        <style type="text/css">
          @media only screen and (min-width:480px) {
            .mj-column-per-100 { width:100% !important; max-width: 100%; }
          }
        </style>
        <style media="screen and (min-width:480px)">
          .moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }
        </style>
    
    
        <style type="text/css">
    
    
    
        @media only screen and (max-width:480px) {
          table.mj-full-width-mobile { width: 100% !important; }
          td.mj-full-width-mobile { width: auto !important; }
        }
    
        </style>
        <style type="text/css">
        @import url('https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
    
          .highlight {
            background-color: #ffc74f;
            color: #000;
            padding: 0 5px;
            border-radius: 3px;
          }
    
          .list-item {
            margin-bottom: 15px;
          }
        </style>
    
      </head>
      <body style="word-spacing:normal;background-color:#f4f4f5;">
    
    
          <div
             style="background-color:#f4f4f5;"
          >
            <!-- Logo and Header -->
    
          <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;"
          >
            <tbody>
              <tr>
                <td  style="width:120px;">
    
          <img
             alt="BoilerCourses" height="auto" src="${data.email.rootUrl}/icon.svg" style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;" width="120"
          />
    
                </td>
              </tr>
            </tbody>
          </table>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Chivo, Arial, sans-serif;font-size:40px;font-weight:900;line-height:1;text-align:center;color:#000000;"
          >BoilerCourses</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:20px;line-height:1;text-align:center;color:#000000;"
          >Please verify your email to receive notifications</div>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:20px;line-height:1;text-align:left;color:#000000;"
          >Hello ${data.email.name},</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:16px;line-height:1;text-align:left;color:#000000;"
          >To receive notifications for the selected courses, please verify your email below. If you didn't register for notifications, you may safely ignore this email.</div>
    
                    </td>
                  </tr>
    
                <!-- Button -->
                  <tr>
                    <td
                       align="center" vertical-align="middle" style="font-size:0px;padding:12px 25px;word-break:break-word;"
                    >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;"
          >
            <tbody>
              <tr>
                <td
                   align="center" bgcolor="#e5e7eb" role="presentation" style="border:1px solid #737373;border-radius:6px;cursor:auto;mso-padding-alt:10px 25px;background:#e5e7eb;" valign="middle"
                >
                  <a
                     href="${data.email.verify()}" style="display:inline-block;background:#e5e7eb;color:#000000;font-family:Inter, Arial, sans-serif;font-size:18px;font-weight:normal;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:10px 25px;mso-padding-alt:0px;border-radius:6px;" target="_blank"
                  >
                    Verify your email
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><![endif]-->
    
        <!-- Footer -->
    
          <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#f4f4f5" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
          <div  style="background:#f4f4f5;background-color:#f4f4f5;margin:0px auto;max-width:600px;">
    
            <table
               align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;background-color:#f4f4f5;width:100%;"
            >
              <tbody>
                <tr>
                  <td
                     style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"
                  >
                    <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
    
          <div
             class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
          >
    
          <table
             border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
          >
            <tbody>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:12px;line-height:1;text-align:center;color:#6b7280;"
          >Sent from BoilerCourses to ${data.email.email}. Don't want to receive any more emails?</div>
    
                    </td>
                  </tr>
    
                  <tr>
                    <td
                       align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                    >
    
          <div
             style="font-family:Inter, Arial, sans-serif;font-size:12px;line-height:1;text-align:center;color:#000000;"
          ><a href="${data.email.unsubscribe()}" style="color: #993128" >
             Permanently unsubscribe from all future emails from BoilerCourses
            </a></div>
    
                    </td>
                  </tr>
    
            </tbody>
          </table>
    
          </div>
    
              <!--[if mso | IE]></td></tr></table><![endif]-->
                  </td>
                </tr>
              </tbody>
            </table>
    
          </div>
    
    
          <!--[if mso | IE]></td></tr></table><![endif]-->
    
    
          </div>
    
      </body>
    </html>
""".trimIndent()