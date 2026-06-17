import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Package, Check, Truck, AlertTriangle } from 'lucide-react';
import { Order } from '../types';

interface DeliveryCalendarProps {
  orders: Order[];
  activeOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
}

const getOrderDeliveryDay = (ord: Order): number => {
  const text = ord.estimatedDelivery.toLowerCase();
  
  if (ord.id === "IL-8392-MX") return 16;
  if (ord.id === "IL-5201-YT") return 15;
  if (ord.id === "IL-1104-KP") return 18;

  if (text.includes("היום") || text.includes("today")) return 16;
  if (text.includes("אתמול") || text.includes("yesterday") || text.includes("15")) return 15;
  if (text.includes("מחר") || text.includes("tomorrow") || text.includes("17")) return 17;
  if (text.includes("18")) return 18;
  if (text.includes("19")) return 19;
  if (text.includes("20")) return 20;

  // Search for any 1-2 digit number
  const match = text.match(/\b([1-9]|[12][0-9]|30)\b/);
  if (match) {
    return parseInt(match[0], 10);
  }

  // fallback based on unique hash
  let hash = 0;
  for (let i = 0; i < ord.id.length; i++) {
    hash += ord.id.charCodeAt(i);
  }
  return 10 + (hash % 15);
};

export default function DeliveryCalendar({ orders, activeOrderId, onSelectOrder }: DeliveryCalendarProps) {
  const [selectedDayInfo, setSelectedDayInfo] = useState<number | null>(null);

  // June 2026 constants
  const daysInJune = 30;
  const startOffset = 1; // 1 empty slot for Sunday (June 1st is Monday)
  const todayDay = 16; // June 16, 2026 based on mock system metadata

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInJune; d++) {
    cells.push({ day: d, key: `day-${d}` });
  }

  // Group orders by day
  const ordersByDay: Record<number, Order[]> = {};
  orders.forEach(ord => {
    const day = getOrderDeliveryDay(ord);
    if (!ordersByDay[day]) {
      ordersByDay[day] = [];
    }
    ordersByDay[day].push(ord);
  });

  const getDayStatusColor = (dayOrders: Order[]) => {
    if (dayOrders.some(o => o.statusKey === 'issue')) return 'bg-red-500';
    if (dayOrders.every(o => o.statusKey === 'delivered')) return 'bg-emerald-500';
    if (dayOrders.some(o => o.statusKey === 'on_the_way')) return 'bg-amber-500';
    return 'bg-[#829460]';
  };

  const getOrderStatusIcon = (statusKey: string) => {
    switch (statusKey) {
      case 'delivered':
        return <Check className="w-3 h-3 text-emerald-600 shrink-0" />;
      case 'on_the_way':
        return <Truck className="w-3 h-3 text-amber-600 shrink-0 animate-bounce" />;
      case 'issue':
        return <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />;
      default:
        return <Package className="w-3 h-3 text-[#829460] shrink-0" />;
    }
  };

  return (
    <div className="bg-[#FAF9F6] border border-[#E0DBCF] rounded-2xl p-4 mt-4 space-y-3 relative" dir="rtl">
      <div className="flex items-center justify-between border-b border-[#E0DBCF]/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#829460]/10 rounded-lg text-[#829460]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[#3E2723] uppercase tracking-wider">יומן מסירות חודשי</h4>
            <p className="text-[10px] text-[#829460] font-semibold">יוני 2026 - מרכז השליטה של נועה</p>
          </div>
        </div>
        <span className="text-[10px] bg-white border border-[#E0DBCF] px-2 py-0.5 rounded-full text-[#3E2723] font-bold">
          {orders.length} חבילות רשומות
        </span>
      </div>

      {/* Weekdays indicator headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[#A39E93] uppercase">
        <div>א'</div>
        <div>ב'</div>
        <div>ג'</div>
        <div>ד'</div>
        <div>ה'</div>
        <div>ו'</div>
        <div>ש'</div>
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} className="h-8 bg-[#F5F5F0]/20 rounded-lg" />;
          }

          const day = cell.day;
          const dayOrders = ordersByDay[day] || [];
          const hasOrders = dayOrders.length > 0;
          const isToday = day === todayDay;
          
          // Check if active order is scheduled for this day
          const hasActiveOrder = dayOrders.some(o => o.id === activeOrderId);

          return (
            <div
              key={cell.key}
              onClick={() => {
                if (hasOrders) {
                  onSelectOrder(dayOrders[0].id);
                  setSelectedDayInfo(selectedDayInfo === day ? null : day);
                } else {
                  setSelectedDayInfo(null);
                }
              }}
              className={`h-9 relative rounded-lg flex flex-col items-center justify-between py-1 cursor-pointer transition-all ${
                isToday 
                  ? 'bg-[#E9EDDE] text-[#3E2723] ring-1 ring-[#829460] font-black' 
                  : 'bg-white text-[#5D4037]'
              } ${
                hasActiveOrder 
                  ? 'ring-2 ring-[#829460] font-bold bg-[#E9EDDE]/50' 
                  : hasOrders 
                    ? 'hover:bg-[#F2F4ED]' 
                    : 'opacity-50 hover:bg-[#FAF9F6] text-stone-400'
              }`}
            >
              {/* Day Number Label */}
              <span className="text-xs">{day}</span>

              {/* Order Indicator Dots container */}
              {hasOrders && (
                <div className="flex gap-0.5 items-center justify-center -mt-1 pb-0.5">
                  {dayOrders.map((ord, idx) => (
                    <span 
                      key={ord.id} 
                      className={`w-1.5 h-1.5 rounded-full ${getDayStatusColor([ord])}`}
                      title={`${ord.id}: ${ord.status}`}
                    />
                  ))}
                </div>
              )}

              {/* Little label marker for 'Today' */}
              {isToday && (
                <span className="absolute -top-1.5 right-1/2 translate-x-1/2 text-[7px] bg-[#829460] text-white px-0.5 rounded leading-none">
                  היום
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Selected Day Details Drawer pop */}
      {selectedDayInfo !== null && ordersByDay[selectedDayInfo] && (
        <div className="p-3 bg-white rounded-xl border border-[#E0DBCF] text-xs space-y-2 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#829460] border-b border-[#E0DBCF]/40 pb-1.5">
            <span>📅 חבילות למסירה ב-{selectedDayInfo} ביוני:</span>
            <button 
              onClick={() => setSelectedDayInfo(null)}
              className="text-[#A39E93] hover:text-[#3E2723] text-[9px] font-bold"
            >
              סגור ✕
            </button>
          </div>
          <div className="space-y-2 max-h-[110px] overflow-y-auto divide-y divide-[#E0DBCF]/30">
            {ordersByDay[selectedDayInfo].map((ord) => (
              <div 
                key={ord.id} 
                onClick={() => onSelectOrder(ord.id)}
                className={`pt-1.5 first:pt-0 cursor-pointer transition-colors ${ord.id === activeOrderId ? 'font-bold' : ''}`}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    {getOrderStatusIcon(ord.statusKey)}
                    <span className="font-mono text-[#3E2723]">{ord.id}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 rounded-full ${
                    ord.statusKey === 'delivered' ? 'bg-emerald-50 text-emerald-700' :
                    ord.statusKey === 'on_the_way' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-700'
                  }`}>
                    {ord.status}
                  </span>
                </div>
                <p className="text-[10px] text-[#5D4037] truncate mt-0.5">{ord.items}</p>
                <p className="text-[9px] text-[#A39E93] truncate mt-1">📍 {ord.deliveryAddress}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Color legend guide */}
      <div className="flex justify-between items-center text-[9px] text-[#A39E93] border-t border-[#E0DBCF]/40 pt-2 px-1">
        <span className="font-bold">מקרא צבעים:</span>
        <div className="flex gap-2">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            נמסר
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            בדרך
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            בעיה/מיון
          </span>
        </div>
      </div>
    </div>
  );
}
