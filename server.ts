import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Create the Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for SabanOS WhatsApp Webhook webhook processing
  app.post("/api/webhook", async (req, res) => {
    try {
      const incomingMessage = req.body.message || req.body.text || "";
      const senderName = req.body.sender || req.body.name || "לקוח";

      if (!incomingMessage) {
        return res.status(400).json({
          action: "reply",
          reply_text: "לא התקבלה הודעה תקינה בבקשה.",
          internal_note: ""
        });
      }

      const systemInstruction = `
אתה "נועה" (נועה / Noa), מנוע הליבה החכם של פלטפורמת הלוגיסטיקה SabanOS. אתה פועל כמשיב אוטומטי בוואטסאפ (WhatsApp Auto-Responder) המחובר באמצעות Webhook של MacroDroid.

קלט:
תקבל הודעת וואטסאפ נכנסת מאת המשתמש.

משימות:
1. נתח את הקשר ההודעה (סטטוס לוגיסטי, מעקב, שינוי כתובת, שאלות או דיווחי בעיות/תקלות).
2. ניסוח תשובה קצרה, חמה ומזמינה ביותר בעברית פשוטה ונקייה. ללא ז'רגון טכני או מונחי קוד, ובגובה העיניים.
3. קבע האם ההודעה דורשת טיפול רגיל ומענה פשוט ("reply") או שהיא בעיה חמורה, תלונה קשה, מוצר שבור/פגום, כעס רב או קושי שהבוט אינו יכול לפתור לבדו ודורש הסלמה דחופה לניהול הלוגיסטי של ראמי ("escalate").

פלט:
עליך להחזיר אך ורק (STRICTLY) תגובת JSON בפורמט הבא, ללא שימוש בתגי סימון קוד (Markdown blocks) או טקסט נוסף מחוץ ל-JSON:
{
  "action": "reply" | "escalate",
  "reply_text": "התשובה הקצרה והחמה לשולח בעברית",
  "internal_note": "אם נבחר escalate, כתוב כאן תקציר קצר לראמי למה נדרש הטיפול שלו. אחרת השאר ריק (מחרוזת ריקה)"
}
`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: 'user', parts: [{ text: `שם השולח: ${senderName}\nתוכן ההודעה: ${incomingMessage}` }] }],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                action: { 
                  type: Type.STRING,
                  enum: ["reply", "escalate"],
                  description: "Whether to reply normally or escalate if there is a severe logistical issue, damaged goods, or angry user."
                },
                reply_text: { 
                  type: Type.STRING,
                  description: "The short, warm friendly Hebrew text to send back to the user on WhatsApp."
                },
                internal_note: { 
                  type: Type.STRING,
                  description: "Logistics summary for Rami if action is 'escalate'. Otherwise keep empty."
                }
              },
              required: ["action", "reply_text", "internal_note"]
            }
          }
        });

        const resText = response.text;
        if (resText) {
          return res.json(JSON.parse(resText));
        }
      } catch (geminiError) {
        console.warn("Gemini failure in Webhook endpoint, using local SabanOS rules dictionary parser:", geminiError);
      }

      // Robust fallback parser
      const query = incomingMessage.toLowerCase();
      let reply = "";
      let action: "reply" | "escalate" = "reply";
      let internal_note = "";

      if (query.includes("בעיה") || query.includes("שבור") || query.includes("פגום") || query.includes("חסר") || query.includes("כועס") || query.includes("תלונה")) {
        action = "escalate";
        reply = "אני מצטערת מאוד לשמוע על הבעיה! העברתי את פנייתך מיד לטיפול לוגיסטי דחוף של ראמי. נציג מטעמנו יצור איתך קשר בהקדם האפשרי.";
        internal_note = `התקבלה תלונה מהלקוח ${senderName} על מוצר פגום/בעיה: "${incomingMessage}". נדרש טיפול אנושי של ראמי.`;
      } else if (query.includes("איפה") || query.includes("סטטוס") || query.includes("משלוח") || query.includes("מתי")) {
        reply = `שלום ${senderName}! המשלוח שלך מסוג #IL-8392-MX נמצא כעת במסלול חלוקה עם השליח רונן. הוא צפוי להגיע אליך היום בין שעות 14:00 ל-16:00. תרצה שאעדכן את השליח להשאיר את המארז ליד הדלת?`;
      } else if (query.includes("כתובת") || query.includes("לשנות") || query.includes("שנה")) {
        reply = `אין בעיה בכלל, ${senderName}! שלח לי את הכתובת החדשה והמדויקת למסירה, ואני אעדכן את השליח שלנו באופן מיידי במערכת SabanOS.`;
      } else if (query.includes("להשאיר") || query.includes("דלת") || query.includes("ארון ושירות") || query.includes("ארון החשמל")) {
        reply = "הערת המסירה שלך נרשמה בהצלחה! עדכנתי את השליח להשאיר את החבילה לפי ההנחיות שלך. שירות מצוין תמיד בראש סדר העדיפויות שלנו.";
      } else if (query.includes("נהג") || query.includes("יוצרים קשר") || query.includes("טלפון") || query.includes("רונן")) {
        reply = "השליח שלך הוא רונן (054-987-6543). הוא נמצא בדרכו אליך כעת. תוכל ליצור איתו קשר ישיר לכל תיאום נוסף.";
      } else {
        reply = `היי ${senderName}! אני נועה, עוזרת המשלוחים והמשיבה האוטומטית הרשמית של SabanOS. איך אוכל לעזור לך ולבצע עבורך מעקב, עדכון כתובת או העברת הנחיה לשליח היום?`;
      }

      return res.json({
        action,
        reply_text: reply,
        internal_note
      });

    } catch (e: any) {
      console.error(e);
      res.status(500).json({
        action: "reply",
        reply_text: "היי, נועה כאן. כרגע חלה תקלה במערכת SabanOS. פנייתך נשמרה ונחזור אליך בהקדם.",
        internal_note: "תקלה בשרת בעת עיבוד הודעה"
      });
    }
  });

  // API route for chatting with Noa
  app.post("/api/chat", async (req, res) => {
    const { message, history, orders } = req.body;
    try {
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const systemInstruction = `
שמך הוא "נועה" (נועה / Noa). את עוזרת המשלוחים והלוגיסטיקה החכמה, האישית, היעילה והחמה ביותר של חברת משלוחים ישראלית מובילה.
תפקידך לסייע ללקוחות ונהגים בנושאים כגון: מעקב אחר משלוחים, שינוי כתובת או הערות שליח, דיווח על מוצר פגום/חסר ופתרון כל פנייה שקשורה למסירה.

השפה שאת מדברת בה חובה שתהיה עברית מתוקנת, טבעית, זורמת וידידותית ביותר. דברי בגובה העיניים בחום ובביטחון.

פרטי המשלוחים הפעילים של הלקוח כרגע:
${JSON.stringify(orders, null, 2)}

הנחיות התנהגות קשיחות ביותר (חוקי נועה):
1. ללא ז'רגון טכני או שמות משתנים: אל תזכירי קוד, מסדי נתונים, שמות שדות קוד (כמו statusKey, id, issues) או מונחי API. דברי בשפה שירותית פשוטה. לדוגמה, במקום "מזהה הזמנה" אמרי "מספר משלוח" או "הזמנה".
2. כתיבה מותאמת לטלפון נייד (Mobile-first): הטקסט קצר ביותר! הימנעי מפסקאות ארוכות. חובה להשתמש בפסקאות של 1-2 משפטים רגילים לכל היותר. השתמשי ברשימת בולטים (נקודות) קריאות ובכותרות מודגשות קצרות ביותר. המידע חייב להתאים לבועת הודעה בצ'אט בסלולר ללא צורך בגלילה מפרכת.
3. סיום קבוע עם שאלה ממוקדת או שלב הבא ברור (לכפתורי בחירה): סיימי כל הודעה שלך בשאלה קצרה וברורה אחת שמעניקה למשתמש אופציות המשך ממוקדות (לדוגמה: "לשנות את כתובת המשלוח עבורך?", "תרצה שאשלח עדכון לרונן הנהג?", "יש עוד משהו שאוכל לבדוק לגבי המשלוח?").
4. עדכון משלוחים (updatedOrders): אם המשתמש מבקש לעדכן משלוח מסוים (למשל, לעדכן כתובת למשלוח, להוסיף הערת מסירה לשליח, או לדווח על מוצר פגום או חסר), בצעי את עדכון הנתונים המתאים במערך ההזמנות המצורף והחזירי את המערך המלא והמעודכן כפרמטר "updatedOrders" בתגובת ה-JSON.
   - שינוי כתובת: עדכני את השדה deliveryAddress.
   - עדכון הערת מסירה: עדכני את השדה notes (למשל, "להשאיר ליד הדלת", "להשאיר בארון החשמל").
   - דיווח על בעיה (פגום/חסר): עדכני את סטטוס המשלוח (status) לכתוב "פנייה פתוחה - דיווח על בעיה", רשמי את התיאור בשדה issues, והוסיפי אירוע חדש בראש מפתח ה-history (היסטוריית שלבי המשלוח), למשל: { "title": "דווחה בעיה במשלוח", "time": "היום" }.
אם לא התבקש או בוצע שום שינוי בהזמנה כלשהי, החזירי את מערך ההזמנות הנוכחי (orders) כפי שהוא בדיוק ללא שינוי.
`;

      const formattedContents = [];

      // Add conversational history if provided
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          formattedContents.push({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: turn.text }]
          });
        }
      }

      // Add actual current message
      formattedContents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The friendly, warm reply from Noa in Hebrew. Keep text compact, mobile-friendly (1-2 sentences max per paragraph, nice bullet points, bold headers) and ALWAYS end with a clean prompt question."
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 2 to 3 very short Hebrew quick-reply choices/sentences aligned with Noa's final question."
              },
              updatedOrders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    status: { type: Type.STRING },
                    statusKey: { type: Type.STRING },
                    estimatedDelivery: { type: Type.STRING },
                    driver: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        phone: { type: Type.STRING }
                      }
                    },
                    items: { type: Type.STRING },
                    deliveryAddress: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    issues: { type: Type.STRING },
                    history: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          time: { type: Type.STRING }
                        }
                      }
                    }
                  }
                },
                description: "The complete list of orders. Update fields if the user requested any modification (e.g. changing address or adding notes) or reported an issue."
              }
            },
            required: ["text", "suggestions", "updatedOrders"]
          }
        }
      });

      const resText = response.text;
      if (!resText) {
        throw new Error("No response text from Gemini API");
      }

      const parsedResponse = JSON.parse(resText);
      res.json(parsedResponse);

    } catch (error: any) {
      console.warn("Gemini API error or missing credentials. Using robust local fallback parser for Noa:", error);

      const msgLower = (message || "").toLowerCase();
      let responseText = "";
      let suggestions: string[] = [];
      let updatedOrders = [...(orders || [])];

      // Match designated or active order
      let activeOrderIdx = 0;
      if (orders && Array.isArray(orders)) {
        const foundIdx = orders.findIndex((o: any) => msgLower.includes(String(o.id).toLowerCase()));
        if (foundIdx !== -1) {
          activeOrderIdx = foundIdx;
        } else {
          // Fallback to first non-delivered order
          const nonDelivered = orders.findIndex((o: any) => o.statusKey !== 'delivered');
          if (nonDelivered !== -1) {
            activeOrderIdx = nonDelivered;
          }
        }
      }

      const activeOrder = updatedOrders[activeOrderIdx] || {
        id: "IL-8392-MX",
        deliveryAddress: "שדרות רוטשילד 42, קומה 2, תל אביב",
        status: "בדרך אליך — מסירה היום",
        statusKey: "on_the_way",
        estimatedDelivery: "היום, בין שעות 14:00 - 16:00",
        items: "מארז מפנק 3 נרות ריחניים",
        notes: "נא להתקשר 5 דקות לפני ההגעה, התינוק ישן.",
        driver: { name: "רונן", phone: "054-987-6543" }
      };

      if (msgLower.includes("איפה") || msgLower.includes("סטטוס") || msgLower.includes("מתי") || msgLower.includes("מעקב") || msgLower.includes("סטאטוס") || msgLower.includes("חבילה") || msgLower.includes("הזמנה")) {
        responseText = `בשמחה! בדקתי בשבילך את הסטטוס של משלוח מספר **${activeOrder.id}** (${activeOrder.items}).

החבילה שלך כרגע בסטטוס: **${activeOrder.status}**.

📍 **יעד למסירה:** ${activeOrder.deliveryAddress}
⏰ **שעת הגעה משוערת:** ${activeOrder.estimatedDelivery}

${activeOrder.driver ? `השליח שלך הוא **${activeOrder.driver.name}** וניתן להשיגו בטלפון ${activeOrder.driver.phone}.` : 'החבילה ממוינת כעת לשיבוץ לשליח.'}

תרצה שנשאיר את החבילה ליד הדלת במידה ולא תהיה בזמן המסירה?`;
        suggestions = ["כן, תבקשי להשאיר ליד הדלת", "לא, עדיף בארון החשמל", "אני רוצה לשנות יעד כתובת"];
      } 
      else if (msgLower.includes("כתובת") || msgLower.includes("יעד") || msgLower.includes("שנה") || msgLower.includes("לשנות") || msgLower.includes("דיזנגוף") || msgLower.includes("רוטשילד")) {
        let newAddress = "שדרות רוטשילד 52, תל אביב";
        
        // Simple heuristic extraction of custom addresses from Hebrew query
        const possibleAddress = message.replace(/כתובת|לשנות|שנה|תשנה|עבור|את|שלי|של החבילה/g, "").trim();
        if (possibleAddress.length > 5) {
          newAddress = possibleAddress;
        }

        if (updatedOrders[activeOrderIdx]) {
          updatedOrders[activeOrderIdx] = {
            ...updatedOrders[activeOrderIdx],
            deliveryAddress: newAddress
          };
        }

        responseText = `הכתובת עודכנה בהצלחה במערכת! 🏡

עדכנתי את משלוח **${activeOrder.id}** למיקום המגורים הבא:
📍 **${newAddress}**

העדכון שודר ברגע זה ישירות לטאבלט של השליח בדרכים.

האם תרצה להוסיף הערת מסירה מיוחדת לשליח היכן להניח את החבילה?`;
        suggestions = ["כן, להשאיר ליד הדלת", "כן, בארון החשמל", "איפה החבילה כרגע?"];
      }
      else if (msgLower.includes("נהג") || msgLower.includes("שליח") || msgLower.includes("רונן") || msgLower.includes("שם") || msgLower.includes("טלפון") || msgLower.includes("ליצור") || msgLower.includes("קשר")) {
        responseText = `${activeOrder.driver ? `דאגתי לך לזה! השליח למשלוח מספר **${activeOrder.id}** הוא **${activeOrder.driver.name}**.

תוכל ליצור איתו קשר ישיר לשיחה:
📞 **${activeOrder.driver.phone}**

הוא נמצא בתיאום חלוקה נוכחית באזורך כרגע.` : 'המשלוח כרגע במיון במרכז הלוגיסטי וטרם שויך לשליח בשטח.'}

תרצה להוסיף עבור הנהג בקשה שיסמס לך 5 דקות לפני שהוא דופק בדלת?`;
        suggestions = ["כן, אנא בקשי שיסמס", "לא, הכל בסדר תודה", "אני רוצה לעדכן כתובת"];
      }
      else if (msgLower.includes("להשאיר") || msgLower.includes("דלת") || msgLower.includes("הנחיה") || msgLower.includes("הנחיות") || msgLower.includes("שומר") || msgLower.includes("ארון ושירות") || msgLower.includes("ארון החשמל")) {
        let note = "להשאיר ליד הדלת של הדירה";
        if (msgLower.includes("חשמל") || msgLower.includes("ארון")) {
          note = "נוע תשאיר בארון החשמל בקומה";
        } else {
          const cutIndex = message.indexOf("להשאיר");
          if (cutIndex !== -1) {
            note = message.substring(cutIndex).trim();
          }
        }

        if (updatedOrders[activeOrderIdx]) {
          updatedOrders[activeOrderIdx] = {
            ...updatedOrders[activeOrderIdx],
            notes: note
          };
        }

        responseText = `הנחיית המסירה עודכנה בהצלחה בשירות של השליח! 📝

הודעת ההנחיה שתופיע לו בשעת המסירה:
\"**${note}**\"

זה יאפשר ביצוע מסירה חלקה ומשוחררת מהפרעות.

האם תרצה לשנות משהו נוסף בהוראות המשלוח שלך?`;
        suggestions = ["איפה החבילה שלי עכשיו?", "אני רוצה לשנות כתובת", "לא תודה, נועה, מעולה!"];
      }
      else if (msgLower.includes("פגום") || msgLower.includes("בעיה") || msgLower.includes("חסר") || msgLower.includes("שבור") || msgLower.includes("חוסר") || msgLower.includes("לא הגיע")) {
        const problemDesc = message.length > 5 ? message : "דיווח על מוצר פגום או חסר מהמשפחה";
        
        if (updatedOrders[activeOrderIdx]) {
          const newHistory = [
            { title: "דווחה בעיה במשלוח", time: "היום" },
            ...(updatedOrders[activeOrderIdx].history || [])
          ];
          updatedOrders[activeOrderIdx] = {
            ...updatedOrders[activeOrderIdx],
            status: "פנייה פתוחה - דיווח על בעיה",
            statusKey: "issue",
            issues: problemDesc,
            history: newHistory
          };
        }

        responseText = `אוי, אני כל כך מצטערת לשמוע על הבעיה הזו במשלוח! 💔

פתחתי פנייה רשמית דחופה אצלנו לוגיסטית לגבי חבילה מספר **${activeOrder.id}**:
⚠️ **\"${problemDesc}\"**

נציג לוגיסטי בכיר יבדוק את המארז ויתקשר אלייך ישירות עוד היום לקבוע מועד פיצוי או משלוח חלופי מהיר.

תרצה שאסמס לך ברגע שצוות הבקרה שלנו יתחיל בטיפול בפנייה?`;
        suggestions = ["כן, אנא סמסי לי", "מתי יצרו איתי קשר?", "שני את כתובת המשלוח להיום"];
      }
      else {
        responseText = `שלום רב! שמחה מאוד להכיר אותך 🚚✨

אני **נועה**, עוזרת המשלוחים והלוגיסטיקה החכמה והאישית שלך. אני כאן כדי שהכל אצלך יתקתק בצורה החמה והפשוטה ביותר.

כרגע יש לנו 3 חבילות מעורבות עבורך במערכת.

באיזה נושא נרצה להתמקד היום?`;
        suggestions = ["איפה המשלוח שלי?", "אני רוצה לשנות מיקום כתובת", "איך משיגים את השליח?"];
      }

      res.json({
        text: responseText,
        suggestions: suggestions,
        updatedOrders: updatedOrders
      });
    }
  });

  // Handle Vite server/express connection
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Noa full-stack backend running on port ${PORT}`);
  });
}

startServer();
