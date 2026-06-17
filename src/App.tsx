import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  RefreshCw,
  Truck,
  CheckCircle2,
  MapPin,
  User,
  Clock,
  Phone,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  ArrowLeft,
  Search,
  Check,
  CornerDownLeft
} from "lucide-react";
import { Message, Order } from "./types";

// Default prompt suggestion sets
const GENERAL_SUGGESTIONS = [
  "איפה המשלוח שלי?",
  "אני רוצה לשנות את כתובת המשלוח להיום",
  "איך יוצרים קשר עם הנהג?",
];

// Initial orders database
const INITIAL_ORDERS: Order[] = [
  {
    id: "IL-8392-MX",
    status: "בדרך אליך — מסירה היום",
    statusKey: "on_the_way",
    estimatedDelivery: "היום, בין שעות 14:00 - 16:00",
    driver: { name: "רונן", phone: "054-987-6543" },
    items: "מארז מפנק 3 נרות ריחניים, מפיץ ריח יוקרתי",
    deliveryAddress: "שדרות רוטשילד 42, קומה 2, תל אביב",
    notes: "נא להתקשר 5 דקות לפני ההגעה, התינוק ישן.",
    history: [
      { title: "יצא עם השליח למסלול חלוקה", time: "היום, 11:30" },
      { title: "הגיע למרכז מיונים ראשי", time: "אתמול, 18:00" },
      { title: "נקלט במחסני החברה", time: "שלשום, 09:15" }
    ]
  },
  {
    id: "IL-5201-YT",
    status: "נמסר בהצלחה",
    statusKey: "delivered",
    estimatedDelivery: "נמסר אתמול ב-17:30",
    items: "אוזניות סטריאו אלחוטיות ANC",
    deliveryAddress: "רחוב העצמאות 12, דירה 6, חיפה",
    notes: "להשאיר בארון החשמל ליד הדלת בקומה 3 במידה ואין מענה",
    history: [
      { title: "חבילה נמסרה", time: "אתמול, 17:30" },
      { title: "יצא עם השליח למסירה", time: "אתמול, 13:00" },
      { title: "נקלט במרכז המיון בצפון", time: "אתמול, 08:00" }
    ]
  },
  {
    id: "IL-1104-KP",
    status: "במיון במרכז הלוגיסטי",
    statusKey: "sorting",
    estimatedDelivery: "18 ביוני, 10:00 - 14:00",
    items: "ספר בישול ים תיכוני, סט סכיני שף מקצועיים",
    deliveryAddress: "רחוב יפו 7, ירושלים",
    notes: "נא להשאיר אצל השומר בכניסה לבניין",
    history: [
      { title: "ממתין למיון קווי מסלול", time: "שלשום, 14:20" },
      { title: "ההזמנה שודרה מחנות המקור", time: "שלשום, 08:10" }
    ]
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>("IL-8392-MX");
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>(GENERAL_SUGGESTIONS);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load orders and initial messages from localStorage or defaults
  useEffect(() => {
    const savedOrders = localStorage.getItem("noa_orders");
    const savedMessages = localStorage.getItem("noa_messages");

    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    } else {
      setOrders(INITIAL_ORDERS);
      localStorage.setItem("noa_orders", JSON.stringify(INITIAL_ORDERS));
    }

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Intro message from Noa
      const initialMsgs: Message[] = [
        {
          id: "welcome-system",
          role: "model",
          text: `שלום למשפחת הלקוחות שלנו! 🚚✨

אני **נועה**, עוזרת המשלוחים האישית שלך. אני כאן כדי לעזור לך לעקוב אחר החבילות שלך, לעדכן הנחיות למסירה, לפתוח פניות או לסייע בכל שאלה הקשורה לשליחות שלך.

יש לנו שלושה משלוחים רשומים עבורך כעת (תוכל לבחור אחד למטה לצפייה מהירה בפרטים). 

איך אוכל לעזור לך היום? 🧡`,
          suggestions: GENERAL_SUGGESTIONS,
          timestamp: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
        }
      ];
      setMessages(initialMsgs);
      localStorage.setItem("noa_messages", JSON.stringify(initialMsgs));
    }
  }, []);

  // Set active order based on the first order if none is active
  useEffect(() => {
    if (orders.length > 0 && !activeOrderId) {
      setActiveOrderId(orders[0].id);
    }
  }, [orders, activeOrderId]);

  // Scroll to bottom whenever messages or suggestions change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, currentSuggestions]);

  // Handle saving to localStorage
  const saveState = (updatedMsgs: Message[], updatedOrds: Order[]) => {
    setMessages(updatedMsgs);
    setOrders(updatedOrds);
    localStorage.setItem("noa_messages", JSON.stringify(updatedMsgs));
    localStorage.setItem("noa_orders", JSON.stringify(updatedOrds));
  };

  // Humanize time for timestamps
  const getHeTime = () => {
    return new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  };

  // Submit message locally and fetch response from Express endpoint
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: text,
      timestamp: getHeTime()
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText("");
    setIsLoading(true);

    try {
      // Format history properly before sending
      const chatHistory = messages
        .filter(m => !m.isSystem)
        .map(m => ({
          role: m.role,
          text: m.text
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: chatHistory,
          orders: orders
        })
      });

      if (!response.ok) {
        throw new Error("Failed to receive response");
      }

      const data = await response.json();

      const modelMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "model",
        text: data.text,
        suggestions: data.suggestions || GENERAL_SUGGESTIONS,
        timestamp: getHeTime()
      };

      const updatedHistory = [...newMsgs, modelMsg];
      
      // Update global packages state if Gemini updated them
      const updatedOrders = data.updatedOrders || orders;
      
      saveState(updatedHistory, updatedOrders);
      setCurrentSuggestions(data.suggestions || GENERAL_SUGGESTIONS);

      // If active order was modified, highlight it or keep it
      if (data.updatedOrders) {
        // Detect which order was changed by comparing items/addresses
        const changedOrder = data.updatedOrders.find((ord: Order, idx: number) => {
          const oldOrd = orders[idx];
          return oldOrd && (
            ord.deliveryAddress !== oldOrd.deliveryAddress || 
            ord.notes !== oldOrd.notes || 
            ord.status !== oldOrd.status ||
            (ord.issues !== oldOrd.issues)
          );
        });
        if (changedOrder) {
          setActiveOrderId(changedOrder.id);
        }
      }

    } catch (err) {
      console.error(err);
      
      // Elegant human-centered friendly error message
      const errorMsg: Message = {
        id: `msg-error-${Date.now()}`,
        role: "model",
        text: `אופס, חלה שגיאת תקשורת קלה בחיבור מולי. 🧡 

אל דאגה, פנייתך חשובה לי מאוד. אנא בדקי שהחיבור לרשת יציב (וגם שמפתח ה-Gemini מבוסס בהצלחה תחת Secrets שבחלון הניהול במידת הצורך). 

נשמח לנסות שוב – לחצי על אחת האפשרויות למטה או שלחי הודעה קצרה.`,
        suggestions: GENERAL_SUGGESTIONS,
        timestamp: getHeTime()
      };
      
      const revertedMsgs = [...newMsgs, errorMsg];
      setMessages(revertedMsgs);
      setCurrentSuggestions(GENERAL_SUGGESTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle preset action clicks
  const handleSuggestionClick = (presetText: string) => {
    handleSendMessage(presetText);
  };

  // Reset demo application
  const handleResetDemo = () => {
    if (window.confirm("האם ברצונך לאתחל את הצ'אט והמשלוחים להגדרות המקוריות?")) {
      localStorage.removeItem("noa_orders");
      localStorage.removeItem("noa_messages");
      setOrders(INITIAL_ORDERS);
      setActiveOrderId("IL-8392-MX");
      
      const initialMsgs: Message[] = [
        {
          id: "welcome-system-reset",
          role: "model",
          text: `שמחה שחזרת! 🚚✨

אני **נועה**, עוזרת המשלוחים שלך. איפוס המערכת הושלם בהצלחה וכל שלושת המשלוחים לדוגמה שוחזרו. 

במה תרצה שנתמקד כעת?`,
          suggestions: GENERAL_SUGGESTIONS,
          timestamp: getHeTime()
        }
      ];
      setMessages(initialMsgs);
      setCurrentSuggestions(GENERAL_SUGGESTIONS);
      setShowOrderDrawer(false);
    }
  };

  // Webhook Simulator State
  const [webhookInput, setWebhookInput] = useState("איפה המשלוח שלי #IL-8392-MX?");
  const [webhookResponse, setWebhookResponse] = useState<any>({
    action: "reply",
    reply_text: "שלום! המשלוח שלך מסוג #IL-8392-MX נמצא כעת במסלול חלוקה עם השליח רונן. הוא צפוי להגיע אליך היום בין שעות 14:00 ל-16:00. תרצה שאעדכן את השליח להשאיר את המארז ליד הדלת?"
  });
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<Array<{ id: string; time: string; msg: string; response: any; status: string }>>([
    {
      id: "log-1",
      time: "18:42",
      msg: "היי, מתי מגיע השליח שלי?",
      response: { action: "reply", reply_text: "שלום! המשלוח שלך צפוי להגיע היום בין שעות 14:00 ל-16:00." },
      status: "SUCCESS"
    }
  ]);

  const handleSendWebhook = async () => {
    if (!webhookInput.trim() || webhookLoading) return;
    setWebhookLoading(true);
    try {
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: webhookInput })
      });

      const data = await response.json();
      setWebhookResponse(data);

      const newLog = {
        id: `webhook-log-${Date.now()}`,
        time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        msg: webhookInput,
        response: data,
        status: response.ok ? "SUCCESS" : "ERROR"
      };
      setWebhookLogs(prev => [newLog, ...prev]);
    } catch (e) {
      console.error(e);
      const errRes = { action: "error", reply_text: "תקשורת נכשלה מול שרת SabanOS." };
      setWebhookResponse(errRes);
      setWebhookLogs(prev => [{
        id: `webhook-log-${Date.now()}`,
        time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        msg: webhookInput,
        response: errRes,
        status: "ERROR"
      }, ...prev]);
    } finally {
      setWebhookLoading(false);
    }
  };

  const activeOrder = orders.find(o => o.id === activeOrderId) || orders[0];

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4 md:p-8 font-sans antialiased text-[#3E2723] selection:bg-[#E9EDDE]" dir="rtl">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-stretch justify-center">
        
        {/* SabanOS Webhook Dashboard Control Panel */}
        <div className="flex-1 bg-white p-6 md:p-8 rounded-[30px] border border-[#E0DBCF] shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-[#E0DBCF]/60 pb-4">
              <div className="p-3 bg-[#829460] text-white rounded-2xl">
                <Send className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] text-[#829460] font-black tracking-wider uppercase">SabanOS CORE LOGISTICS</span>
                <h1 className="text-xl font-extrabold text-[#3E2723] leading-tight">סימולטור סימולציות Webhook — נועה</h1>
              </div>
            </div>

            <p className="text-sm text-[#5D4037] leading-relaxed">
              מנוע הליבה החכם של פלטפורמת הלוגיסטיקה <strong className="font-bold text-[#829460]">SabanOS</strong>. המערכת מנתחת פניות לוגיסטיות, מעוברת בהודעות וואטסאפ (WhatsApp Webhook), ומחזירה תגובת JSON נקייה לערוץ הרלוונטי.
            </p>

            {/* Test Payload Form */}
            <div className="space-y-3 bg-[#FAF9F6] p-4 rounded-2xl border border-[#E0DBCF]/50">
              <label className="block text-xs font-bold text-[#829460]">הזן הודעת לקוח/נהג נכנסת (וואטסאפ):</label>
              <textarea
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                placeholder="לדוגמה: איפה המשלוח שלי?"
                rows={2}
                className="w-full bg-white text-sm p-3 rounded-xl border border-[#E0DBCF] focus:ring-2 focus:ring-[#829460] focus:border-transparent outline-none font-medium text-[#3E2723] resize-none"
              />
              
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-[#5D4037] font-semibold flex items-center">טען תבניות:</span>
                <button
                  onClick={() => setWebhookInput("מתי מגיעה החבילה שלי IL-8392-MX?")}
                  className="text-xs bg-white border border-[#E0DBCF] hover:bg-[#F2F4ED] text-[#5D4037] px-2.5 py-1 rounded-lg transition-all"
                >
                  📍 סטטוס ומעקב
                </button>
                <button
                  onClick={() => setWebhookInput("אני רוצה לשנות כתובת לשדרות רוטשילד 60")}
                  className="text-xs bg-white border border-[#E0DBCF] hover:bg-[#F2F4ED] text-[#5D4037] px-2.5 py-1 rounded-lg transition-all"
                >
                  🏠 שינוי יעד
                </button>
                <button
                  onClick={() => setWebhookInput("המוצר הגיע שבור וסדוק")}
                  className="text-xs bg-white border border-[#E0DBCF] hover:bg-[#F2F4ED] text-[#5D4037] px-2.5 py-1 rounded-lg transition-all"
                >
                  ⚠️ דיווח פגום
                </button>
              </div>

              <button
                onClick={handleSendWebhook}
                disabled={webhookLoading || !webhookInput.trim()}
                className="w-full mt-2 bg-[#829460] hover:bg-[#6E804E] text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {webhookLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    ננעל על מענה לוגיסטי...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 transform scale-x-[-1]" />
                    שלח בקשת Webhook נכנסת (POST /api/webhook)
                  </>
                )}
              </button>
            </div>

            {/* Response Output Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#829460] flex items-center gap-1">
                  תגובת שרת רשמית של SabanOS (JSON):
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(webhookResponse, null, 2));
                    alert("פורמט JSON הועתק ללוח!");
                  }}
                  className="text-[11px] text-[#A39E93] hover:text-[#5D4037] underline font-bold"
                >
                  העתק JSON ללוח
                </button>
              </div>

              <div className="bg-[#2D2421] text-stone-200 text-xs font-mono p-4 rounded-2xl overflow-x-auto direction-ltr max-h-[180px] select-all shadow-inner border border-stone-800">
                <pre>{JSON.stringify(webhookResponse, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Webhook Logs History list */}
          <div className="space-y-2 pt-4 border-t border-[#E0DBCF]/50">
            <h3 className="text-xs font-black text-[#829460] uppercase tracking-wider">לוג תעבורת Webhooks של נועה:</h3>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto divide-y divide-[#E0DBCF]/30">
              {webhookLogs.map((log) => (
                <div key={log.id} className="pt-2 flex items-start justify-between text-xs">
                  <div className="flex items-start gap-2 max-w-[75%]">
                    <span className="font-semibold text-[#A39E93] shrink-0">{log.time}</span>
                    <div className="truncate">
                      <p className="font-bold text-[#3E2723] truncate">📥 {log.msg}</p>
                      <p className="text-[#829460] text-[10px] truncate mt-0.5">📤 {log.response?.reply_text}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
              {webhookLogs.length === 0 && (
                <p className="text-xs text-[#A39E93] py-2 text-center">אין לוגים לשעשוע כרגע.</p>
              )}
            </div>
          </div>
        </div>

        {/* Premium Full-Screen Mobile Mockup */}
        <div className="w-full lg:w-[410px] shrink-0 bg-[#FDFBF7] md:rounded-[40px] md:shadow-2xl md:border-8 md:border-[#5D4037] h-screen md:h-[820px] flex flex-col overflow-hidden relative">
        
        {/* Animated Notch area - only on simulated desktop */}
        <div className="hidden md:flex absolute top-0 inset-x-0 h-7 bg-[#3E2723] text-[#FAF9F6]/85 justify-between items-center px-8 z-50 text-[11px] font-mono select-none">
          <span>{new Date().toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <div className="w-20 h-4 bg-black rounded-b-xl absolute left-1/2 transform -translate-x-1/2 top-0" />
          <div className="flex items-center gap-1.5 direction-ltr">
            <span>⚡ 98%</span>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Header - App Branding & Noa Avatar */}
        <header className="bg-white border-b border-[#E0DBCF] pt-7 md:pt-10 pb-4 px-4 sticky top-0 z-40 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Elegant pulsing status and warm sage avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-[#829460] flex items-center justify-center text-white text-lg shadow-sm font-bold antialiased">
                נועה
              </div>
              <span className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>

            <div>
              <h1 className="font-bold text-[#3E2723] text-base leading-tight">נועה</h1>
              <p className="text-xs text-[#829460] font-semibold uppercase tracking-wider">עוזרת אישית חכמה</p>
            </div>
          </div>

          <button
            onClick={handleResetDemo}
            title="איפוס שיחה"
            className="p-2.5 rounded-full bg-[#F5F5F0] hover:bg-[#E0DBCF]/40 text-[#5D4037] hover:text-[#3E2723] transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        {/* Active Package Quick Status Bar */}
        <section className="bg-[#F5F5F0]/70 border-b border-[#E0DBCF] px-4 py-3 flex items-center justify-between cursor-pointer select-none hover:bg-[#F5F5F0] transition-colors duration-150"
          onClick={() => setShowOrderDrawer(!showOrderDrawer)}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 h-8 w-8 rounded-lg bg-[#E9EDDE] flex items-center justify-center text-[#829460]">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5D4037] font-mono font-bold">#{activeOrder?.id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold leading-none ${
                  activeOrder?.statusKey === 'delivered' ? 'bg-[#E9EDDE] text-[#829460]' :
                  activeOrder?.statusKey === 'on_the_way' ? 'bg-[#FAF9F6] text-[#829460] border border-[#E9EDDE]' :
                  activeOrder?.statusKey === 'sorting' ? 'bg-[#F2F4ED] text-[#5D4037]' :
                  'bg-[#F8EFEA] text-[#B08968]'
                }`}>
                  {activeOrder?.status}
                </span>
              </div>
              <p className="text-xs text-[#3E2723] font-bold mt-0.5 truncate max-w-[200px]">
                {activeOrder?.items}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-[#5D4037] font-bold bg-[#E0DBCF]/45 px-2.5 py-1 rounded-full transition-all">
            <span>כל משלוחיי</span>
            {showOrderDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </section>

        {/* Global Orders List Drawer / Collapsible View */}
        <AnimatePresence>
          {showOrderDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="bg-[#FDFBF7] border-b border-[#E0DBCF] overflow-hidden z-30"
            >
              <div className="p-4 max-h-[350px] overflow-y-auto space-y-3 divide-y divide-[#E0DBCF]/40">
                <div className="pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#829460] uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" />
                    החבילות הרשומות שלך (לחץ לבחירה):
                  </h3>
                </div>

                <div className="space-y-2 pt-2">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setActiveOrderId(ord.id);
                        setShowOrderDrawer(false);
                      }}
                      className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                        ord.id === activeOrderId
                          ? "border-[#829460] bg-[#E9EDDE]/30 shadow-sm"
                          : "border-[#E0DBCF]/50 bg-white hover:bg-[#F5F5F0]/40 text-[#5D4037]"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#3E2723] text-sm font-mono">{ord.id}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              ord.statusKey === 'delivered' ? 'bg-[#E9EDDE] text-[#829460]' :
                              ord.statusKey === 'on_the_way' ? 'bg-[#FAF9F6] text-[#829460] border border-[#E9EDDE]' :
                              ord.statusKey === 'sorting' ? 'bg-[#F2F4ED] text-[#5D4037]' :
                              'bg-[#F8EFEA] text-[#B08968]'
                            }`}>
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#5D4037] mt-1 line-clamp-1">{ord.items}</p>
                          <p className="text-[11px] text-[#A39E93] mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#A39E93]" />
                            {ord.deliveryAddress}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Focused Order Dashboard Board Card */}
        {activeOrder && (
          <div className="bg-white border-b border-[#E0DBCF] p-4 shrink-0 flex flex-col gap-2.5 shadow-sm">
            <div className="bg-[#FDFBF7] rounded-2xl p-3.5 border border-[#E0DBCF]/60">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-[#829460] font-black tracking-widest uppercase">פרטי משלוח ממוקד</span>
                  <p className="text-lg font-black text-[#3E2723] font-mono -mt-1 leading-tight">{activeOrder.id}</p>
                </div>
                
                {/* Auto Suggestions buttons for this specific package to help user query Noa instantly */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      handleSendMessage(`איפה המשלוח שלי ${activeOrder.id}?`);
                    }}
                    className="text-[11px] font-bold bg-[#829460] hover:bg-[#6E804E] text-white px-3 py-1 rounded-full transition-all duration-150 shadow-sm"
                  >
                    איפה זה? 📍
                  </button>
                  <button
                    onClick={() => {
                      handleSendMessage(`אני רוצה לשנות כתובת להזמנה ${activeOrder.id}`);
                    }}
                    className="text-[11px] font-bold bg-white text-[#5D4037] hover:bg-[#FDFBF7] border border-[#E0DBCF] px-3 py-1 rounded-full transition-all duration-150 shadow-sm"
                  >
                    שנה כתובת 🏠
                  </button>
                </div>
              </div>

              {/* Delivery info details columns */}
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-[#5D4037] divide-x divide-[#E0DBCF]/50 divide-x-reverse">
                <div className="pr-1 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#829460]">
                    <MapPin className="w-3 h-3 text-[#829460]" /> כתובת יעד
                  </div>
                  <p className="font-bold text-[#3E2723] leading-snug line-clamp-2">{activeOrder.deliveryAddress}</p>
                </div>
                
                <div className="pl-1 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#829460]">
                    <Clock className="w-3 h-3 text-[#829460]" /> צפי הגעה
                  </div>
                  <p className="font-bold text-[#3E2723] leading-tight">{activeOrder.estimatedDelivery}</p>
                </div>
              </div>

              {/* Delivery driver or special notes */}
              <div className="mt-2.5 pt-2 border-t border-[#E0DBCF]/60 flex items-center justify-between text-[11px]">
                {activeOrder.driver ? (
                  <div className="flex items-center gap-1.5 text-[#5D4037]">
                    <User className="w-3 h-3 text-[#829460]" />
                    <span>שליח: <strong className="text-[#3E2723]">{activeOrder.driver.name}</strong> ({activeOrder.driver.phone})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[#A39E93]">
                    <Truck className="w-3 h-3" />
                    <span>טרם שובץ שליח</span>
                  </div>
                )}
                
                <div className="text-[#5D4037] max-w-[50%] truncate shrink text-left" title={activeOrder.notes}>
                  <strong className="text-[#829460] font-bold text-[10px]">הנחיית מסירה:</strong> {activeOrder.notes}
                </div>
              </div>

              {/* If reported an issue */}
              {activeOrder.issues && (
                <div className="mt-2 p-2 bg-[#F8EFEA] border border-[#E0DBCF] rounded-xl flex items-center gap-2 text-[11px] text-[#829460] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>בוצע דיווח: {activeOrder.issues}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Stream Bubble Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#FDFBF7] flex flex-col">
          
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "model" ? "self-start items-start" : "self-end items-end"
              }`}
            >
              
              {/* Sender info */}
              <span className="text-[10px] text-[#A39E93] font-semibold mb-0.5 px-1.5">
                {msg.role === "model" ? "נועה" : "אני"} • {msg.timestamp}
              </span>

              {/* Message Bubble Container */}
              <div className={`p-4 rounded-2xl text-[#3E2723] leading-relaxed text-sm ${
                msg.role === "model"
                  ? "bg-[#E9EDDE] border border-[#DCE2CC] rounded-tr-none shadow-sm font-medium"
                  : "bg-[#D7CCC8]/95 rounded-tl-none shadow-sm font-medium"
              }`}>
                
                {/* Markdown layout helper render */}
                <div className="whitespace-pre-line break-words gap-1 font-sans">
                  {msg.text}
                </div>

                {/* Inline status timeline map inside Noa's messages of package details for ultimate high-fidelity */}
                {msg.role === "model" && activeOrder && msg.text.includes(activeOrder.id) && (
                  <div className="mt-3 pt-3 border-t border-[#DCE2CC] space-y-2">
                    <div className="text-[11px] text-[#829460] font-extrabold flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      סטטוס נוכחי של משלוח: השלבים במעקב
                    </div>
                    
                    {/* Tiny responsive elegant timeline */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {["נקלט במזרח", "במיון", "בדרך", "נמסר"].map((step, idx) => {
                        const stepKeys = ["sorting", "sorting", "on_the_way", "delivered"];
                        
                        // Simple active logic
                        let isActive = false;
                        if (activeOrder.statusKey === "delivered") {
                          isActive = true;
                        } else if (activeOrder.statusKey === "on_the_way" && idx < 3) {
                          isActive = true;
                        } else if (activeOrder.statusKey === "sorting" && idx < 2) {
                          isActive = true;
                        } else if (idx === 0) {
                          isActive = true;
                        }

                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 relative">
                            {/* Connect lines */}
                            {idx < 3 && (
                              <div className={`absolute top-2.5 left-[-50%] right-1/2 h-0.5 bg-stone-300 -z-0 ${
                                isActive ? "bg-[#829460]" : ""
                              }`} />
                            )}
                            
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 font-bold ${
                              isActive ? "bg-[#829460] text-white" : "bg-[#F5F5F0] text-[#A39E93]"
                            }`}>
                              {isActive ? "✓" : idx + 1}
                            </div>
                            <span className="text-[9px] text-[#5D4037] font-bold mt-1 text-center truncate w-full">
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Typing Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="self-start flex flex-col items-start max-w-[85%]"
            >
              <span className="text-[10px] text-[#A39E93] font-semibold mb-0.5 px-1.5">
                נועה תומכת...
              </span>
              <div className="bg-[#E9EDDE]/70 border border-[#DCE2CC] p-3 rounded-2xl rounded-tr-none flex items-center gap-2 shadow-sm text-xs font-semibold text-[#5D4037]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#829460] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-[#829460] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-[#829460] animate-bounce" />
                </div>
                <span>נועה מחשבת מענה עבורך...</span>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Quick Actions Horizontal Rail */}
        <div className="bg-[#FDFBF7] px-4 pb-2 pt-1 border-t border-[#E0DBCF]/60 flex flex-wrap gap-1.5 max-h-[105px] overflow-y-auto select-none">
          {currentSuggestions.map((sug, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.02, backgroundColor: "#F2F4ED" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSuggestionClick(sug)}
              className="text-[#829460] bg-white hover:bg-[#F2F4ED] rounded-full border border-[#829460] text-xs py-1.5 px-4 font-bold transition-all duration-150 flex items-center gap-1 shadow-sm"
            >
              <span>{sug}</span>
              <CornerDownLeft className="w-3 h-3 text-[#829460]/70" />
            </motion.button>
          ))}
        </div>

        {/* Bottom Form input and Send controls */}
        <div className="bg-white border-t border-[#E0DBCF] p-3 pb-4 md:pb-6 flex items-center gap-2">
          {/* Decorative attachment clip style from design HTML */}
          <div className="w-11 h-11 bg-[#F5F5F0] rounded-full flex items-center justify-center text-[#A39E93] hover:text-[#5D4037] hover:bg-[#E0DBCF]/40 cursor-pointer transition-all duration-150 shrink-0"
               onClick={() => alert("צירוף קבצים כרגע זמין כהדמיה עבור הנהג או הלקוח")}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex-1 flex gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="כתבי הודעה כאן..."
              disabled={isLoading}
              className="flex-1 bg-[#F5F5F0] text-[#3E2723] placeholder-[#A39E93] text-sm py-2.5 px-4 rounded-2xl focus:bg-white focus:ring-2 focus:ring-[#829460] outline-none transition-all font-medium border-none"
            />
            
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-[#829460] hover:bg-[#6E804E] active:scale-95 text-white w-12 h-12 rounded-2xl shadow-md disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none transition-all duration-150 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4 transform scale-x-[-1]" />
            </button>
          </form>
        </div>

      </div> {/* closes Phone Mockup */}
    </div> {/* closes lg:flex-row outer */}
  </div> /* closes root div container */
  );
}
