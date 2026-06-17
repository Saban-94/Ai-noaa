import { NextResponse } from "next/server";
// הנחה שיש לך קובץ אתחול של פיירבייס בפרויקט
import { db } from "@/lib/firebase"; 
import { collection, addDoc } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sender, message, driverId } = body;

    if (!message) {
      return NextResponse.json({ error: "חסר תוכן הודעה" }, { status: 400 });
    }

    // כתיבה מהירה למסד הנתונים של פיירבייס
    const docRef = await addDoc(collection(db, "messages"), {
      sender: sender || "לא ידוע",
      message: message,
      driverId: driverId || "system",
      createdAt: Date.now() // שימוש בשדה המעודכן לסידור זמנים נכון
    });

    return NextResponse.json({ success: true, id: docRef.id });
    
  } catch (error) {
    console.error("Error injecting message to DB:", error);
    return NextResponse.json({ error: "שגיאת שרת בהזרקת הנתונים" }, { status: 500 });
  }
}
