import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { Search, Send, Paperclip, MoreVertical, Phone, Video, CheckCheck, UserPlus, Edit2, Check, X, CheckSquare, Square, Send as SendIcon, Target, Plus } from 'lucide-react';

export const ChatInboxView: React.FC = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<'all' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Contact Name Editing State
  const [editingName, setEditingName] = useState<boolean>(false);
  const [customNameInput, setCustomNameInput] = useState<string>('');

  // Multi-Select Contact Broadcast State
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [sendingBroadcast, setSendingBroadcast] = useState<boolean>(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Add to Kanban Modal State
  const [showKanbanModal, setShowKanbanModal] = useState<boolean>(false);
  const [kanbanTargetCol, setKanbanTargetCol] = useState<string>('col_1');
  const [kanbanNotes, setKanbanNotes] = useState<string>('');
  const [kanbanValue, setKanbanValue] = useState<string>('$50.000');
  const [isBulkKanban, setIsBulkKanban] = useState<boolean>(false);
  const [addingToKanban, setAddingToKanban] = useState<boolean>(false);

  const fetchChats = async () => {
    try {
      const res = await API.get('/chats');
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

      const resTeam = await API.get('/team');
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
      if (data && data.chatId) {
        setChats((prevChats) => {
          return prevChats.map((c) => {
            if (c.id === data.chatId) {
              return {
                ...c,
                lastMessageTime: 'Ahora',
                lastMessageText: data.message?.content || c.lastMessageText,
                messages: [...(c.messages || []), data.message],
              };
            }
            return c;
          });
        });
      }
    });

    return () => {
      socket.off('new_message');
    };
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const messageContent = inputText;
    setInputText('');

    const newMsg = {
      id: `msg_${Date.now()}`,
      direction: 'OUTBOUND',
      content: messageContent,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'SENT',
    };

    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChat.id) {
          return {
            ...c,
            lastMessageText: messageContent,
            lastMessageTime: 'Ahora',
            messages: [...(c.messages || []), newMsg],
          };
        }
        return c;
      })
    );

    try {
      await API.post('/chats/send', {
        chatId: activeChat.id,
        text: messageContent,
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleAssignAgent = async (agentName: string) => {
    if (!activeChat) return;
    try {
      await API.post('/chats/assign', {
        chatId: activeChat.id,
        agentName,
      });

      setChats((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, assignedAgent: agentName } : c))
      );
    } catch (err) {
      console.error(err);
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
      console.error(err);
    }
  };

  const handleToggleSelectContact = (chatId: string) => {
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

  const handleSendBroadcastToSelected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedContactIds.length === 0 || !broadcastMessage.trim()) return;

    setSendingBroadcast(true);
    setBroadcastStatus(null);

    try {
      const res = await API.post('/chats/broadcast-contacts', {
        contactIds: selectedContactIds,
        messageText: broadcastMessage.trim(),
      });

      if (res.data.success) {
        setBroadcastStatus(`¡Difusión enviada con éxito a ${selectedContactIds.length} contactos!`);
        setBroadcastMessage('');
        setSelectedContactIds([]);
        setMultiSelectMode(false);
        setTimeout(() => {
          setShowBroadcastModal(false);
          setBroadcastStatus(null);
        }, 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error enviando difusión a contactos');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Add active single chat or bulk selected contacts to Kanban
  const handleOpenKanbanModal = (bulk: boolean = false) => {
    setIsBulkKanban(bulk);
    if (!bulk && activeChat) {
      setKanbanNotes(activeChat.lastMessageText || 'Solicitud comercial enviada por cliente');
    }
    setShowKanbanModal(true);
  };

  const handleAddKanbanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingToKanban(true);

    try {
      if (isBulkKanban) {
        const selectedChatsObjects = chats
          .filter((c) => selectedContactIds.includes(c.id))
          .map((c) => ({
            chatId: c.id,
            contactName: c.contactName,
            phone: c.phone,
            lastMessageText: c.lastMessageText,
          }));

        const res = await API.post('/kanban/bulk-add', {
          contacts: selectedChatsObjects,
          columnId: kanbanTargetCol,
        });

        if (res.data.success) {
          alert(`¡${selectedContactIds.length} contactos agregados al Embudo Kanban!`);
          setShowKanbanModal(false);
          setMultiSelectMode(false);
          setSelectedContactIds([]);
        }
      } else if (activeChat) {
        const res = await API.post('/kanban/add-from-chat', {
          chatId: activeChat.id,
          contactName: activeChat.contactName,
          phone: activeChat.phone,
          columnId: kanbanTargetCol,
          notes: kanbanNotes.trim(),
          value: kanbanValue.trim(),
        });

        if (res.data.success) {
          alert(`¡Oportunidad "${activeChat.contactName}" agregada al Embudo Kanban!`);
          setShowKanbanModal(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingToKanban(false);
    }
  };


  const filteredChats = chats.filter((c) => {
    const matchesSearch =
      c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    const matchesFilter = filter === 'all' || (filter === 'unassigned' && !c.assignedAgent);
    return matchesSearch && matchesFilter;
  });

  const kanbanColumnNames: Record<string, string> = {
    col_1: 'Contacto Nuevo',
    col_2: 'En Cotización / Negociación',
    col_3: 'En Seguimiento',
    col_4: 'Venta Cerrada',
    col_5: 'Terminado',
  };

  return (
    <div className="chat-container">
      {/* Panel Izquierdo: Lista de Chats */}
      <div className="chat-list-panel">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💬 Bandeja Multi-Agente
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem', marginBottom: '0.75rem' }}>
            <Search size={16} color="var(--text-dim)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Botón de Modo Selección Masiva de Contactos & Agregar a Kanban */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${multiSelectMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }}
              onClick={() => {
                setMultiSelectMode(!multiSelectMode);
                if (multiSelectMode) setSelectedContactIds([]);
              }}
            >
              {multiSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{multiSelectMode ? 'Cancelar' : '☑️ Selección Masiva'}</span>
            </button>

            {multiSelectMode && selectedContactIds.length > 0 && (
              <>
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => handleOpenKanbanModal(true)}
                  title="Agregar contactos seleccionados al Embudo Kanban"
                >
                  <Target size={13} /> <span>🎯 ({selectedContactIds.length}) Kanban</span>
                </button>
                <button
                  className="btn btn-success"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => setShowBroadcastModal(true)}
                >
                  <SendIcon size={12} /> Difundir
                </button>
              </>
            )}
          </div>
        </div>

        {multiSelectMode && (
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(99, 102, 241, 0.1)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span>{selectedContactIds.length} seleccionados</span>
            <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={handleSelectAllContacts}>
              {selectedContactIds.length === filteredChats.length ? 'Deseleccionar' : 'Marcar Todos'}
            </button>
          </div>
        )}

        <div className="chat-list">
          {filteredChats.map((chat) => {
            const isSelected = selectedContactIds.includes(chat.id);
            return (
              <div
                key={chat.id}
                className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => {
                  if (multiSelectMode) {
                    handleToggleSelectContact(chat.id);
                  } else {
                    setActiveChatId(chat.id);
                  }
                }}
              >
                {multiSelectMode && (
                  <div style={{ marginRight: '0.5rem' }}>
                    {isSelected ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--text-dim)" />}
                  </div>
                )}
                <img src={chat.avatarUrl} alt={chat.contactName} className="chat-avatar" />
                <div className="chat-info">
                  <div className="chat-name-row">
                    <span className="chat-name">{chat.contactName}</span>
                    <span className="chat-time">{chat.lastMessageTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span className="chat-preview">{chat.lastMessageText}</span>
                    {chat.assignedAgent && (
                      <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>
                        👤 {chat.assignedAgent}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Botón Principal para Agregar este Contacto al Embudo Kanban */}
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                  onClick={() => handleOpenKanbanModal(false)}
                  title="Agregar este contacto al Embudo de Ventas Kanban"
                >
                  <Target size={16} /> <span>🎯 Agregar a Embudo Kanban</span>
                </button>

                {/* Selector Interactivo de Asignación de Vendedor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                    onChange={(e) => handleAssignAgent(e.target.value)}
                  >
                    <option value="">-- Asignar Vendedor --</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.name}>
                        👤 {member.name} ({member.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="chat-messages-body">
              {(activeChat.messages || []).map((msg: any) => (
                <div
                  key={msg.id}
                  className={`message-bubble ${msg.direction === 'OUTBOUND' ? 'outbound' : 'inbound'}`}
                >
                  <p style={{ margin: 0 }}>{msg.content}</p>
                  <div className="message-meta">
                    <span>{msg.sentAt}</span>
                    {msg.direction === 'OUTBOUND' && (
                      <CheckCheck size={14} color="var(--accent-blue)" style={{ marginLeft: '4px' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-footer">
              <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                className="chat-input"
                placeholder="Escribe un mensaje de respuesta a través de OpenWA..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
            Selecciona una conversación para comenzar a chatear.
          </div>
        )}
      </div>

      {/* Modal de Agregar a Embudo Kanban */}
      {showKanbanModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={20} color="var(--primary)" />
                <span>
                  {isBulkKanban
                    ? `Agregar ${selectedContactIds.length} Contactos a Kanban`
                    : `Agregar a Kanban: ${activeChat?.contactName}`}
                </span>
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowKanbanModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddKanbanSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Etapa del Embudo Kanban
                </label>
                <select
                  className="chat-input"
                  style={{ width: '100%', padding: '0.6rem' }}
                  value={kanbanTargetCol}
                  onChange={(e) => setKanbanTargetCol(e.target.value)}
                >
                  <option value="col_1">🟣 Contacto Nuevo</option>
                  <option value="col_2">🟡 En Cotización / Negociación</option>
                  <option value="col_3">🔵 En Seguimiento</option>
                  <option value="col_4">🟢 Venta Cerrada</option>
                  <option value="col_5">💗 Terminado</option>
                </select>
              </div>

              {!isBulkKanban && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Valor Estimado
                    </label>
                    <input
                      type="text"
                      className="chat-input"
                      style={{ width: '100%' }}
                      value={kanbanValue}
                      onChange={(e) => setKanbanValue(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Notas / Detalle de la Solicitud
                    </label>
                    <textarea
                      className="chat-input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                      value={kanbanNotes}
                      onChange={(e) => setKanbanNotes(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowKanbanModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingToKanban}>
                  {addingToKanban ? 'Agregando...' : 'Agregar al Embudo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Difusión Masiva a Contactos Seleccionados */}
      {showBroadcastModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SendIcon size={18} color="var(--accent-green)" /> Difusión a {selectedContactIds.length} Contactos
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowBroadcastModal(false)}>
                <X size={16} />
              </button>
            </div>

            {broadcastStatus && (
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {broadcastStatus}
              </div>
            )}

            <form onSubmit={handleSendBroadcastToSelected}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Mensaje Masivo por WhatsApp
                </label>
                <textarea
                  className="chat-input"
                  rows={4}
                  style={{ width: '100%', resize: 'none' }}
                  placeholder="Escribe el mensaje..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBroadcastModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingBroadcast || !broadcastMessage.trim()}>
                  {sendingBroadcast ? 'Enviando...' : `Enviar a ${selectedContactIds.length} Contactos`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
