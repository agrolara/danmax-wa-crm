import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, Users, Zap, X } from 'lucide-react';

export const BroadcastCalendarView: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 13)); // August 2026
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: '',
    messageContent: '',
    targetTag: 'Clientes VIP',
    scheduledFor: '2026-08-15T10:00',
  });

  const fetchBroadcasts = async () => {
    try {
      const res = await API.get('/broadcasts');
      if (res.data.success) {
        setBroadcasts(res.data.broadcasts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 13));
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/broadcasts', {
        ...form,
      });
      if (res.data.success) {
        setShowModal(false);
        setForm({
          title: '',
          messageContent: '',
          targetTag: 'Clientes VIP',
          scheduledFor: '2026-08-15T10:00',
        });
        fetchBroadcasts();
      }
    } catch (err) {
      console.error(err);
    }
  };


  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month (0 = Sun, 1 = Mon...)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Generate 35 cells for 7x5 calendar grid
  const calendarCells = [];

  // Previous month padding days
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      dateStr: null,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      dateStr: `${year}-${formattedMonth}-${formattedDay}`,
    });
  }

  // Next month padding days to complete 35 cells
  const remainingCells = 35 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: false,
      dateStr: null,
    });
  }

  return (
    <div className="calendar-view">
      {/* Top Controls Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📅 Calendario de Difusión Masiva (Google Calendar Style)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Programa envíos masivos por WhatsApp usando la programación en tiempo real de OpenWA.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Agendar Campaña Masiva
        </button>
      </div>

      {/* Month Navigation Control Bar */}
      <div className="calendar-month-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {monthNames[month]} {year}
          </h3>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem' }} onClick={handlePrevMonth} title="Mes Anterior">
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={handleToday}>
              Hoy
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem' }} onClick={handleNextMonth} title="Mes Siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <span className="badge badge-purple" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
          ⚡ OpenWA Schedule Engine Active
        </span>
      </div>

      {/* 7 Columns Days Header */}
      <div className="calendar-grid-header">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="calendar-day-head">
            {d}
          </div>
        ))}
      </div>

      {/* 7x5 Month Grid Body */}
      <div className="calendar-grid-body">
        {calendarCells.map((cell, idx) => {
          const isToday = cell.isCurrentMonth && cell.day === 13 && month === 7 && year === 2026;

          const dayBroadcasts = cell.isCurrentMonth
            ? broadcasts.filter((b) => {
                const bDate = new Date(b.scheduledFor);
                return bDate.getDate() === cell.day && bDate.getMonth() === month && bDate.getFullYear() === year;
              })
            : [];

          return (
            <div
              key={idx}
              className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => {
                if (cell.isCurrentMonth) {
                  setSelectedDayNumber(cell.day);
                  const formattedDay = String(cell.day).padStart(2, '0');
                  setForm((prev) => ({
                    ...prev,
                    scheduledFor: `2026-08-${formattedDay}T10:00`,
                  }));
                  setShowModal(true);
                }
              }}
            >
              <div className="calendar-day-number">{cell.day}</div>

              {dayBroadcasts.map((b) => (
                <div key={b.id} className="calendar-event-pill" title={`${b.title}: ${b.messageContent}`}>
                  📢 {b.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Modal Agendamiento */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ width: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={18} color="var(--primary)" />
                <span>Programar Campaña Masiva</span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Título de la Campaña
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%' }}
                  placeholder="Ej: Promo 2x1 Viernes"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Audiencia Objetivo
                </label>
                <select
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={form.targetTag}
                  onChange={(e) => setForm({ ...form, targetTag: e.target.value })}
                >
                  <option value="Clientes VIP">Clientes VIP (145 contactos)</option>
                  <option value="Todos los contactos">Todos los contactos (320 contactos)</option>
                  <option value="Frecuentes">Frecuentes (89 contactos)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Fecha y Hora de Envío
                </label>
                <input
                  type="datetime-local"
                  className="chat-input"
                  style={{ width: '100%' }}
                  value={form.scheduledFor}
                  onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Contenido del Mensaje de WhatsApp
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', height: '80px', resize: 'none' }}
                  placeholder="Escribe el mensaje masivo..."
                  value={form.messageContent}
                  onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Agendar en OpenWA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
