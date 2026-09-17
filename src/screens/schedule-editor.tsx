import React, { useState, useMemo, useRef } from "react";
import { useStore, userById, wsName } from "../lib/store";
import { SHIFT_META, ShiftType, User } from "../lib/types";
import {
  todayKey, monthTitle, rangeKeys, WD, weekdayIdx, isWeekend, daysInMonth, shiftMonth, fmtDate,
} from "../lib/time";
import { I, Avatar, useToast, Seg, Field, Empty, Modal, Tabs } from "../components/ui";
import { exportScheduleMonth, parseScheduleFile, scheduleTemplate } from "../lib/excel";

// Режимы редактирования
type EditMode = "single" | "brush" | "preset";

export function ScheduleEditor() {
  const { db, setShift, fillPattern, publishSchedule, importSchedule } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"table" | "bulk">("table");
  
  return (
    <div className="grid gap-4">
      <Tabs active={tab} onChange={(v) => setTab(v as any)} tabs={[
        { id: "table", label: "Таблица (как Excel)", icon: "grid" },
        { id: "bulk", label: "Массовое планирование", icon: "users" },
      ]} />
      
      {tab === "table" ? <TableView /> : <BulkView />}
    </div>
  );
}

// ================= ТАБЛИЧНЫЙ ВИД (КАК EXCEL) =================
function TableView() {
  const { db, setShift, publishSchedule, importSchedule } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7));
  const [mode, setMode] = useState<EditMode>("brush");
  const [brushType, setBrushType] = useState<ShiftType>("day");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  
  const emps = db.users.filter((u) => u.role === "employee" && u.active && !u.archived);
  const dim = daysInMonth(mk + "-01");
  const keys = rangeKeys(`${mk}-01`, `${mk}-${String(dim).padStart(2, "0")}`);
  
  const getCellKey = (userId: string, date: string) => `${userId}:${date}`;
  
  const getShiftType = (userId: string, date: string): ShiftType | null => {
    const cell = db.schedule.find((s) => s.userId === userId && s.date === date);
    return cell?.type || null;
  };
  
  const handleCellClick = (userId: string, date: string, e: React.MouseEvent) => {
    if (mode === "single") {
      // Одиночный клик - циклическая смена
      const current = getShiftType(userId, date);
      const next = getNextType(current);
      setShift(userId, date, next, "");
    } else if (mode === "brush") {
      // Кисть - применяем выбранный тип
      setShift(userId, date, brushType, "");
    }
  };
  
  const handleMouseDown = (userId: string, date: string) => {
    if (mode === "brush") {
      setIsDragging(true);
      setShift(userId, date, brushType, "");
    }
  };
  
  const handleMouseEnter = (userId: string, date: string) => {
    if (isDragging && mode === "brush") {
      setShift(userId, date, brushType, "");
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const getNextType = (current: ShiftType | null): ShiftType | null => {
    const order: (ShiftType | null)[] = [null, "day", "night", "off", "vacation", "sick"];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  };
  
  return (
    <div className="grid gap-4">
      {/* Панель управления */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, -1))}>
            <I n="chevL" size={14} />
          </button>
          <b className="font-display text-sm w-40 text-center">{monthTitle(mk + "-01")}</b>
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, 1))}>
            <I n="chevR" size={14} />
          </button>
          
          <div className="h-6 w-px bg-line mx-2" />
          
          {/* Режим редактирования */}
          <Seg small opts={[
            { v: "single", label: "Одиночный", icon: "edit" },
            { v: "brush", label: "Кисть", icon: "draw" },
          ]} val={mode} onChange={(v) => setMode(v as EditMode)} />
          
          {/* Выбор типа смены для кисти */}
          {mode === "brush" && (
            <div className="flex gap-1.5">
              {Object.entries(SHIFT_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setBrushType(key as ShiftType)}
                  className={`badge ${meta.cls} cursor-pointer transition-all ${
                    brushType === key ? "ring-2 ring-offset-2 ring-accent scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {meta.code}
                </button>
              ))}
            </div>
          )}
          
          <div className="ml-auto flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                
                try {
                  if (file.name.endsWith(".json")) {
                    const data = JSON.parse(await file.text());
                    if (Array.isArray(data)) {
                      const res = importSchedule(data, "Импорт из JSON");
                      toast(`Импортировано: ${res.ok} ячеек`, "ok");
                    }
                  } else {
                    const cells = await parseScheduleFile(file, mk + "-01");
                    const res = importSchedule(cells, "Импорт из Excel");
                    toast(`Импортировано: ${res.ok} ячеек${res.missing.length ? `, неизвестные: ${res.missing.join(", ")}` : ""}`, 
                          res.missing.length ? "bad" : "ok");
                  }
                } catch {
                  toast("Ошибка чтения файла", "bad");
                }
              }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <I n="upload" size={13} />Импорт
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              exportScheduleMonth(db, mk + "-01");
              toast("Экспортировано в Excel", "ok");
            }}>
              <I n="download" size={13} />Экспорт
            </button>
            <button className="btn btn-pri btn-sm" onClick={() => {
              publishSchedule(mk);
              toast("График опубликован — сотрудники уведомлены", "ok");
            }}>
              <I n="send" size={13} />Опубликовать
            </button>
          </div>
        </div>
        
        {/* Подсказка */}
        <div className="mt-3 text-[11px] text-mute font-bold flex items-center gap-2">
          <I n="info" size={13} />
          {mode === "single" 
            ? "Клик по ячейке — циклическая смена типа (нет → день → ночь → выходной → ...)"
            : `Выберите тип смены и проведите мышкой по ячейкам для быстрого заполнения`}
        </div>
      </div>
      
      {/* Таблица */}
      <div className="card overflow-hidden">
        <div 
          className="overflow-auto max-h-[70vh]"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <table className="tbl" style={{ minWidth: `${150 + dim * 40}px` }}>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <th className="sticky left-0 bg-surface z-20 min-w-[150px]">Сотрудник</th>
                {keys.map((date) => {
                  const day = Number(date.slice(8));
                  const wd = weekdayIdx(date);
                  const isToday = date === tk;
                  return (
                    <th 
                      key={date}
                      className={`text-center min-w-[40px] !px-1 !py-1.5 ${
                        isToday ? "!bg-accent-soft !text-accent-deep" : 
                        isWeekend(date) ? "!bg-paper text-mute" : ""
                      }`}
                    >
                      <div className="text-[9px] opacity-70">{WD[wd]}</div>
                      <div className="text-[11px] font-bold">{day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {emps.map((u) => (
                <tr key={u.id}>
                  <td className="sticky left-0 bg-surface z-10 border-r border-line">
                    <div className="flex items-center gap-2">
                      <Avatar u={u} size={24} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate">{u.name}</div>
                        <div className="text-[9px] text-mute truncate">{wsName(db, u.workshopId)}</div>
                      </div>
                    </div>
                  </td>
                  {keys.map((date) => {
                    const type = getShiftType(u.id, date);
                    const meta = type ? SHIFT_META[type] : null;
                    const cellKey = getCellKey(u.id, date);
                    const isSelected = selectedCells.has(cellKey);
                    
                    return (
                      <td 
                        key={date}
                        className={`!p-0.5 text-center cursor-pointer select-none transition-all ${
                          isWeekend(date) ? "bg-paper/30" : ""
                        } ${isSelected ? "ring-2 ring-inset ring-accent" : ""}`}
                        onClick={(e) => handleCellClick(u.id, date, e)}
                        onMouseDown={() => handleMouseDown(u.id, date)}
                        onMouseEnter={() => handleMouseEnter(u.id, date)}
                      >
                        <div className={`h-8 rounded grid place-items-center text-[11px] font-extrabold transition-all ${
                          meta ? `${meta.cls} hover:scale-110` : "bg-transparent text-line hover:bg-paper"
                        }`}>
                          {meta ? meta.code : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Легенда */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap text-[12px]">
          <span className="font-bold text-mute">Легенда:</span>
          {Object.entries(SHIFT_META).map(([key, meta]) => (
            <span key={key} className={`badge ${meta.cls}`}>
              {meta.code} — {meta.label}
            </span>
          ))}
          <span className="badge bg-paper text-mute">— нет смены</span>
        </div>
      </div>
    </div>
  );
}

// ================= МАССОВОЕ ПЛАНИРОВАНИЕ =================
function BulkView() {
  const { db, fillPattern, publishSchedule } = useStore();
  const { toast } = useToast();
  const tk = todayKey();
  const [mk, setMk] = useState(tk.slice(0, 7));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wsFilter, setWsFilter] = useState("");
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<"5/2" | "2/2" | "3/3" | "all" | "clear">("5/2");
  const [night, setNight] = useState(false);
  const [offset, setOffset] = useState(0);
  const [comment, setComment] = useState("");
  const [periodStart, setPeriodStart] = useState(1);
  const [periodEnd, setPeriodEnd] = useState(daysInMonth(mk + "-01"));
  
  const emps = db.users.filter((u) => u.role === "employee" && u.active && !u.archived
    && (!wsFilter || u.workshopId === wsFilter)
    && (!search || u.name.toLowerCase().includes(search.toLowerCase())));
  
  const dim = daysInMonth(mk + "-01");
  const allSelected = emps.length > 0 && emps.every((u) => selected.has(u.id));
  
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  
  const applyPreset = () => {
    if (selected.size === 0) {
      toast("Выберите сотрудников", "bad");
      return;
    }
    
    // Если указан период, применяем только к нему
    const periodKeys = rangeKeys(`${mk}-${String(periodStart).padStart(2, "0")}`, `${mk}-${String(periodEnd).padStart(2, "0")}`);
    
    selected.forEach((userId) => {
      // Очищаем период
      periodKeys.forEach((date) => {
        setShift(userId, date, null, comment.trim());
      });
      
      // Применяем пресет
      if (preset !== "clear") {
        periodKeys.forEach((date) => {
          const wd = weekdayIdx(date);
          const since = Math.floor(Date.parse(date) / 86400000) - offset;
          let work = false;
          
          if (preset === "5/2") work = wd < 5;
          if (preset === "2/2") work = ((since % 4) + 4) % 4 < 2;
          if (preset === "3/3") work = ((since % 6) + 6) % 6 < 3;
          if (preset === "all") work = true;
          
          if (work) {
            const type: ShiftType = night ? "night" : "day";
            setShift(userId, date, type, comment.trim());
          }
        });
      }
    });
    
    toast(`Применено к ${selected.size} сотрудникам (${periodStart}-${periodEnd} ${monthTitle(mk + "-01")})`, "ok");
  };
  
  const setShift = (userId: string, date: string, type: ShiftType | null, comment: string) => {
    const { setShift: storeSetShift } = useStore();
    storeSetShift(userId, date, type, comment);
  };
  
  return (
    <div className="grid gap-4">
      {/* Панель управления */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, -1))}>
            <I n="chevL" size={14} />
          </button>
          <b className="font-display text-sm w-40 text-center">{monthTitle(mk + "-01")}</b>
          <button className="btn btn-ghost btn-sm" onClick={() => setMk(shiftMonth(mk, 1))}>
            <I n="chevR" size={14} />
          </button>
          
          <div className="h-6 w-px bg-line mx-2" />
          
          <input 
            className="input !h-9 !w-56" 
            placeholder="Поиск по имени…" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          
          <select 
            className="input !h-9 !w-48" 
            value={wsFilter} 
            onChange={(e) => setWsFilter(e.target.value)}
          >
            <option value="">Все цеха</option>
            {db.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          
          <button 
            className={`btn btn-sm ${allSelected ? "btn-dark" : "btn-ghost"}`}
            onClick={() => setSelected(allSelected ? new Set() : new Set(emps.map((u) => u.id)))}
          >
            <I n={allSelected ? "x" : "check"} size={13} />
            {allSelected ? "Снять выбор" : `Выбрать всех (${emps.length})`}
          </button>
        </div>
      </div>
      
      {/* Пресеты */}
      <div className="card p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Пресет графика</h3>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Seg 
              small 
              opts={[
                { v: "5/2", label: "5/2" },
                { v: "2/2", label: "2/2" },
                { v: "3/3", label: "3/3" },
                { v: "all", label: "Каждый день" },
                { v: "clear", label: "Очистить" },
              ]} 
              val={preset} 
              onChange={setPreset} 
            />
            
            <button 
              className={`btn btn-sm ${night ? "btn-dark" : "btn-ghost"}`}
              onClick={() => setNight(!night)}
            >
              <I n="moon" size={13} />
              {night ? "Ночные" : "Дневные"}
            </button>
            
            {(preset === "2/2" || preset === "3/3") && (
              <label className="flex items-center gap-2 text-[12px] font-bold text-mute">
                Сдвиг цикла:
                <input 
                  type="number" 
                  min={0} 
                  max={27} 
                  className="input !w-20 !h-8 tnum" 
                  value={offset} 
                  onChange={(e) => setOffset(Number(e.target.value) || 0)} 
                />
                дн.
              </label>
            )}
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-bold text-mute">Период:</span>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold">с</span>
              <input 
                type="number" 
                min={1} 
                max={dim} 
                className="input !w-20 !h-8 tnum" 
                value={periodStart} 
                onChange={(e) => setPeriodStart(Math.max(1, Math.min(dim, Number(e.target.value) || 1)))} 
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold">по</span>
              <input 
                type="number" 
                min={1} 
                max={dim} 
                className="input !w-20 !h-8 tnum" 
                value={periodEnd} 
                onChange={(e) => setPeriodEnd(Math.max(1, Math.min(dim, Number(e.target.value) || dim)))} 
              />
            </label>
          </div>
          
          <input 
            className="input !h-9" 
            placeholder="Комментарий к изменениям (увидят сотрудники)" 
            value={comment} 
            onChange={(e) => setComment(e.target.value)} 
          />
          
          <button 
            className="btn btn-pri" 
            disabled={selected.size === 0}
            onClick={applyPreset}
          >
            <I n="zap" size={14} />
            Применить к {selected.size || "…"} сотрудникам ({periodStart}-{periodEnd} число)
          </button>
        </div>
      </div>
      
      {/* Список сотрудников */}
      <div className="card p-4">
        <h3 className="font-display text-sm font-semibold mb-3">
          Сотрудники ({emps.length}) · Выбрано: {selected.size}
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto dark-scroll">
          {emps.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleSelect(u.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                selected.has(u.id) 
                  ? "border-accent bg-accent-soft" 
                  : "border-line hover:border-steel-400"
              }`}
            >
              <span className={`w-5 h-5 rounded grid place-items-center shrink-0 ${
                selected.has(u.id) ? "bg-accent text-white" : "border border-line"
              }`}>
                {selected.has(u.id) && <I n="check" size={12} />}
              </span>
              <Avatar u={u} size={28} />
              <span className="min-w-0 flex-1">
                <b className="text-[12px] block truncate">{u.name}</b>
                <span className="text-[10px] text-mute font-bold truncate block">
                  {wsName(db, u.workshopId)}
                </span>
              </span>
            </button>
          ))}
        </div>
        {emps.length === 0 && (
          <Empty icon="users" title="Сотрудники не найдены" text="Измените фильтры или создайте сотрудников" />
        )}
      </div>
      
      {/* Публикация */}
      <div className="card p-4">
        <button 
          className="btn btn-pri w-full"
          onClick={() => {
            publishSchedule(mk);
            toast("График опубликован — сотрудники уведомлены", "ok");
          }}
        >
          <I n="send" size={16} />
          Опубликовать график на {monthTitle(mk + "-01")}
        </button>
      </div>
    </div>
  );
}
