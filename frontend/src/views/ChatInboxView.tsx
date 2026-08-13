import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { Send, UserCheck, Search, Paperclip, CheckCheck, UserPlus, Edit2, Check, X, Send as SendIcon, CheckSquare, Square } from 'lucide-react';

export const ChatInboxView: React.FC = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [assigning, setAssigning] = useState<boolean>(false);

  // Contact Renaming state
  const [editingName, setEditingName] = useState<boolean>(false);
  const [customNameInput, setCustomNameInput] = useState<string>('');

  // Multi-Select Contact Broadcast State
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [sendingBroadcast, setSendingBroadcast] = useState<boolean>(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const fetchChats = async () => {
    try {
      const res = await API.get('/chats?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        const fetchedChats = res.data.chats;
        setChats(fetchedChats);

        const targetChatId = localStorage.getItem('danmax_target_chat');
        if (targetChatId && fetchedChats.length > 0) {
          const matched = fetchedChats.find(
            (c: any) =>
              c.id === targetChatId ||
              c.phone === targetChatId ||
              c.contactName?.toLowerCase() === targetChatId.toLowerCase() ||
              c.id.includes(targetChatId) ||
              targetChatId.includes(c.id)
          );
          if (matched) {
            setActiveChatId(matched.id);
          } else {
            setActiveChatId(fetchedChats[0].id);
          }
          localStorage.removeItem('danmax_target_chat');
        } else if (fetchedChats.length > 0 && !activeChatId) {
          setActiveChatId(fetchedChats[0].id);
        }
      }

      const resTeam = await API.get('/team?tenantId=tenant_demo_pizzeria');
      if (resTeam.data.success) {
        setTeamMembers(resTeam.data.team || []);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  useEffect(() => {
    fetchChats();

    socket.on('new_message', (data: any) => {
      setChats((prevChats) =>
        prevChats.map((c) => {
          if (c.id === data.chatId) {
            return {
              ...c,
              lastMessageText: data.message.content,
              lastMessageAt: data.message.sentAt,
              messages: [...c.messages, data.message],
            };
          }
          return c;
        })
      );
    });

    return () => {
      socket.off('new_message');
    };
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId);

  const handleAssignAgent = async (chatId: string, agentName: string) => {
    setAssigning(true);
    try {
      const res = await API.post('/chats/assign-agent', { chatId, agentName });
      if (res.data.success) {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, assignedAgent: agentName || null } : c))
        );
      }
    } catch (err) {
      console.error('Error assigning agent:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveContactName = async () => {
    if (!activeChat || !customNameInput.trim()) return;

    try {
      const res = await API.post('/chats/update-contact-name', {
        chatId: activeChat.id,
        contactName: customNameInput.trim(),
      });

      if (res.data.success) {
        setChats((prev) =>
          prev.map((c) => (c.id === activeChat.id ? { ...c, contactName: customNameInput.trim() } : c))
        );
        setEditingName(false);
      }
    } catch (err) {
      console.error('Error updating contact name:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    const textToSend = inputText;
    setInputText('');

    try {
      await API.post('/chats/send', {
        chatId: activeChatId,
        tenantId: 'tenant_demo_pizzeria',
        content: textToSend,
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const toggleSelectContact = (chatId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSelectAllContacts = () => {
    if (selectedContactIds.length === filteredChats.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredChats.map((c) => c.id));
    }
  };

  const handleSendMassBroadcast = async () => {
    if (selectedContactIds.length === 0 || !broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    setBroadcastStatus(null);

    try {
      const res = await API.post('/chats/broadcast-contacts', {
        chatIds: selectedContactIds,
        messageText: broadcastMessage.trim(),
      });

      if (res.data.success) {
        setBroadcastStatus(`¡Mensaje masivo enviado a ${selectedContactIds.length} contactos!`);
        setTimeout(() => {
          setShowBroadcastModal(false);
          setBroadcastMessage('');
          setSelectedContactIds([]);
          setMultiSelectMode(false);
          setBroadcastStatus(null);
        }, 2000);
      }
    } catch (err) {
      console.error('Error sending broadcast:', err);
      setBroadcastStatus('Error enviando mensaje masivo');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const filteredChats = chats.filter((c) => {
    if (filter === 'mine') return c.assignedAgent === 'Super Admin DanMax WA' || c.assignedAgent === 'Juan Vendedor';
    if (filter === 'unassigned') return !c.assignedAgent;
    return true;
  });

  return (
    <div className="chat-container">
      {/* Panel Izquierdo: Lista de Chats */}
      <div className="chat-list-panel">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem', marginBottom: '0.75rem' }}>
            <Search size={16} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Buscar conversación o teléfono..."
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', marginLeft: '0.5rem', fontSize: '0.85rem', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
            <button
              className={`btn btn-secondary ${filter === 'all' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem' }}
              onClick={() => setFilter('all')}
            >
              Todos ({chats.length})
            </button>
            <button
              className={`btn btn-secondary ${filter === 'unassigned' ? 'active' : ''}`}
              style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem' }}
              onClick={() => setFilter('unassigned')}
            >
              Sin Asignar
            </button>
          </div>

          {/* Botón de Modo Selección Masiva de Contactos */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              className={`btn ${multiSelectMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
              onClick={() => {
                setMultiSelectMode(!multiSelectMode);
                if (multiSelectMode) setSelectedContactIds([]);
              }}
            >
              {multiSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{multiSelectMode ? 'Cancelar Selección' : '☑️ Selección Masiva'}</span>
            </button>
            {multiSelectMode && selectedContactIds.length > 0 && (
              <button
                className="btn btn-success"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => setShowBroadcastModal(true)}
              >
                <SendIcon size={12} /> ({selectedContactIds.length}) Enviar
              </button>
            )}
          </div>
        </div>

        {multiSelectMode && (
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(99, 102, 241, 0.1)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span>{selectedContactIds.length} contactos seleccionados</span>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={handleSelectAllContacts}>
              {selectedContactIds.length === filteredChats.length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => {
                if (multiSelectMode) {
                  toggleSelectContact(chat.id);
                } else {
                  setActiveChatId(chat.id);
                }
              }}
            >
              {multiSelectMode && (
                <input
                  type="checkbox"
                  checked={selectedContactIds.includes(chat.id)}
                  onChange={() => toggleSelectContact(chat.id)}
                  style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                />
              )}
              <img src={chat.avatarUrl} alt={chat.contactName} className="chat-avatar" />
              <div className="chat-info">
                <div className="chat-name">
                  <span>{chat.contactName}</span>
                  <span className="chat-time">
                    {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="chat-last-msg">{chat.lastMessageText}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: chat.assignedAgent ? 'var(--primary)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <UserCheck size={12} /> {chat.assignedAgent || 'Sin asignar'}
                  </span>
                  {chat.unreadCount > 0 && (
                    <span className="badge badge-amber">{chat.unreadCount} nuevo</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel Derecho: Mensajes y Conversación */}
      <div className="chat-view-panel">
        {activeChat ? (
          <>
            <div className="chat-view-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={activeChat.avatarUrl} alt={activeChat.contactName} className="chat-avatar" />
                <div>
                  {editingName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="chat-input"
                        style={{ fontSize: '0.9rem', padding: '2px 8px' }}
                        value={customNameInput}
                        onChange={(e) => setCustomNameInput(e.target.value)}
                        placeholder="Nombre de contacto..."
                        autoFocus
                      />
                      <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={handleSaveContactName}>
                        <Check size={14} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditingName(false)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{activeChat.contactName}</h3>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                        title="Agendar / Cambiar Nombre de Contacto"
                        onClick={() => {
                          setCustomNameInput(activeChat.contactName || '');
                          setEditingName(true);
                        }}
                      >
                        <Edit2 size={12} /> <span>Agendar Nombre</span>
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeChat.phone}</div>
                </div>
              </div>

              {/* Selector Interactivo de Asignación de Vendedor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={16} color="var(--primary)" />
                <select
                  className="chat-input"
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                    fontWeight: 700,
                    background: activeChat.assignedAgent ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-main)',
                    color: activeChat.assignedAgent ? 'var(--primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                  }}
                  value={activeChat.assignedAgent || ''}
                  onChange={(e) => handleAssignAgent(activeChat.id, e.target.value)}
                  disabled={assigning}
                >
                  <option value="">-- Sin Vendedor Asignado --</option>
                  <option value="Super Admin DanMax WA">👤 Super Admin DanMax WA</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.fullName || m.name}>
                      👤 {m.fullName || m.name} ({m.role || 'Vendedor'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="messages-list">
              {activeChat.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`msg-bubble ${msg.direction === 'INBOUND' ? 'inbound' : 'outbound'}`}
                >
                  <div>{msg.content}</div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      opacity: 0.8,
                      textAlign: 'right',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.direction === 'OUTBOUND' && <CheckCheck size={14} color="#67e8f9" />}
                  </div>
                </div>
              ))}
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <button type="button" className="btn btn-secondary" title="Adjuntar catálogo o archivo">
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                className="chat-input"
                placeholder="Escribe un mensaje de respuesta a través de OpenWA..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Selecciona una conversación para comenzar a responder chats.
          </div>
        )}
      </div>

      {/* Modal de Difusión Masiva a Contactos Personales */}
      {showBroadcastModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SendIcon size={20} color="var(--primary)" />
                <span>Difusión Masiva a {selectedContactIds.length} Contactos Seleccionados</span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowBroadcastModal(false)}>
                <X size={16} />
              </button>
            </div>

            {broadcastStatus && (
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontWeight: 600, fontSize: '0.85rem' }}>
                {broadcastStatus}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Mensaje para enviar a todos los contactos seleccionados:
              </label>
              <textarea
                className="chat-input"
                rows={5}
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="Escribe tu oferta, información o saludo masivo aquí..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowBroadcastModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSendMassBroadcast} disabled={sendingBroadcast || !broadcastMessage.trim()}>
                {sendingBroadcast ? 'Enviando Mensajes...' : `Enviar a ${selectedContactIds.length} Contactos`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
