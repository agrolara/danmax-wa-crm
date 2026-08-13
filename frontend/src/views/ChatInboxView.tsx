import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { socket } from '../services/socket';
import { Send, UserCheck, Search, Paperclip, FileText, Image as ImageIcon, CheckCheck } from 'lucide-react';

export const ChatInboxView: React.FC = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all');

  const fetchChats = async () => {
    try {
      const res = await API.get('/chats?tenantId=tenant_demo_pizzeria');
      if (res.data.success) {
        setChats(res.data.chats);
        if (res.data.chats.length > 0 && !activeChatId) {
          setActiveChatId(res.data.chats[0].id);
        }
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    const textToSend = inputText;
    setInputText('');

    try {
      await API.post('/chats/send', {
        chatId: activeChatId,
        tenantId: 'tenant_demo_pizzeria',
        text: textToSend,
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const filteredChats = chats.filter((c) => {
    if (filter === 'mine') return c.assignedAgent === 'Juan Vendedor';
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
          <div style={{ display: 'flex', gap: '0.25rem' }}>
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
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => setActiveChatId(chat.id)}
            >
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{activeChat.contactName}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeChat.phone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-blue">Agente: {activeChat.assignedAgent || 'No asignado'}</span>
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
    </div>
  );
};
