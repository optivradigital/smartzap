'use client'

import React from 'react';
import { MessageSquare, Zap, Image, Video, FileText, ExternalLink, Phone, Copy } from 'lucide-react';
import { TemplateComponent, TemplateButton } from '../../types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Replaces template variables like {{1}}, {{2}} with actual values
 */
const replaceVariables = (text: string, variables?: string[]): string => {
  if (!variables || !Array.isArray(variables) || variables.length === 0) return text;

  let result = text;
  variables.forEach((value, index) => {
    const placeholder = `{{${index + 1}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  });

  return result;
};

// ============================================================================
// BUTTON ICONS
// ============================================================================

const BUTTON_ICONS: Record<string, React.ReactNode> = {
  'URL': <ExternalLink size={14} />,
  'PHONE_NUMBER': <Phone size={14} />,
  'QUICK_REPLY': <Zap size={14} />,
  'COPY_CODE': <Copy size={14} />,
  'OTP': <Copy size={14} />,
  'FLOW': <MessageSquare size={14} />,
  'CATALOG': <MessageSquare size={14} />,
  'MPM': <MessageSquare size={14} />,
  'VOICE_CALL': <Phone size={14} />,
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MessageButtonProps {
  button: TemplateButton;
}

const MessageButton: React.FC<MessageButtonProps> = ({ button }) => (
  <div className="bg-[#202c33] text-[#00a884] text-center py-2.5 rounded-lg shadow-sm text-[13px] font-medium cursor-pointer hover:bg-[#2a3942] transition-colors flex items-center justify-center gap-2">
    {BUTTON_ICONS[button.type] || <Zap size={14} />}
    {button.text}
  </div>
);

interface MessageHeaderProps {
  header: TemplateComponent;
  variables?: string[];
  headerImageUrl?: string;
}

const MessageHeader: React.FC<MessageHeaderProps> = ({ header, variables, headerImageUrl }) => {
  switch (header.format) {
    case 'TEXT':
      if (!header.text) return null;
      return (
        <div className="bg-[#202c33] p-2 px-3 rounded-lg rounded-tl-none shadow-sm mb-1">
          <p className="text-[13px] font-bold text-white">{replaceVariables(header.text, variables)}</p>
        </div>
      );
    case 'IMAGE':
      return (
        <div className="bg-[#202c33] rounded-lg rounded-tl-none shadow-sm mb-1 overflow-hidden">
          {headerImageUrl
            ? <img src={headerImageUrl} alt="header" className="w-full h-32 object-cover" />
            : <div className="bg-zinc-700/50 h-32 flex items-center justify-center"><Image size={32} className="text-zinc-500" /></div>
          }
        </div>
      );
    case 'VIDEO':
      return (
        <div className="bg-[#202c33] rounded-lg rounded-tl-none shadow-sm mb-1 overflow-hidden">
          <div className="bg-zinc-700/50 h-32 flex items-center justify-center">
            <Video size={32} className="text-zinc-500" />
          </div>
        </div>
      );
    case 'DOCUMENT':
      return (
        <div className="bg-[#202c33] rounded-lg rounded-tl-none shadow-sm mb-1 p-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <FileText size={20} />
            <span className="text-[12px]">Documento anexado</span>
          </div>
        </div>
      );
    default:
      return null;
  }
};

// ============================================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================================

interface MessageBubbleProps {
  components?: TemplateComponent[];
  variables?: string[];
  /** Fallback content when no components available */
  fallbackContent?: string;
  headerImageUrl?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  components,
  variables,
  fallbackContent,
  headerImageUrl,
}) => {
  // Parse components
  const header = components?.find(c => c.type === 'HEADER');
  const body = components?.find(c => c.type === 'BODY');
  const footer = components?.find(c => c.type === 'FOOTER');
  const buttons = components?.find(c => c.type === 'BUTTONS');

  // If no components but has fallback content, show just the body
  const bodyText = body?.text || fallbackContent || 'Sem conteúdo';
  const hasContent = components?.length || fallbackContent;

  if (!hasContent) {
    return (
      <div className="text-[13px] text-[#e9edef] leading-relaxed">
        Nenhum conteúdo disponível
      </div>
    );
  }

  const hasButtons = buttons?.buttons && buttons.buttons.length > 0;

  return (
    <div className="animate-in zoom-in-95 slide-in-from-bottom-2 duration-500 max-w-[95%]">
      {/* Header */}
      {header && <MessageHeader header={header} variables={variables} headerImageUrl={headerImageUrl} />}

      {/* Message Card (Body + Buttons united) */}
      <div className={`bg-[#202c33] shadow-sm overflow-hidden ${hasButtons ? 'rounded-t-lg rounded-tl-none' : 'rounded-lg rounded-tl-none'}`}>
        {/* Body */}
        <div className="p-3 text-[13px] leading-relaxed text-[#e9edef]">
          {replaceVariables(bodyText, variables)}

          {/* Footer */}
          {footer?.text && (
            <p className="text-[11px] text-[#8696a0] mt-2 italic">{replaceVariables(footer.text, variables)}</p>
          )}

          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[9px] text-[#8696a0]">10:42</span>
          </div>
        </div>

        {/* Buttons (inside same card) */}
        {hasButtons && buttons?.buttons && (
          <div className="border-t border-[#111b21]">
            {buttons.buttons.map((button, index) => (
              <div
                key={index}
                className={`text-[#00a884] text-center py-2.5 text-[13px] font-medium cursor-pointer hover:bg-[#182229] transition-colors flex items-center justify-center gap-2 ${index < (buttons.buttons?.length ?? 0) - 1 ? 'border-b border-[#111b21]' : ''
                  }`}
              >
                {BUTTON_ICONS[button.type] || <Zap size={14} />}
                {button.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT - WHATSAPP PHONE PREVIEW
// ============================================================================

interface WhatsAppPhonePreviewProps {
  /** Template components (header, body, footer, buttons) */
  components?: TemplateComponent[];
  /** Variables to replace in template. Index 0 = {{1}}, Index 1 = {{2}}, etc. */
  variables?: string[];
  /** Fallback content when no components available */
  fallbackContent?: string;
  /** Business name shown in header */
  businessName?: string;
  /** Whether to show empty state placeholder */
  showEmptyState?: boolean;
  /** Custom empty state message */
  emptyStateMessage?: string;
  /** Phone mockup size: 'sm' | 'md' | 'lg' | 'adaptive' (fills container) */
  size?: 'sm' | 'md' | 'lg' | 'adaptive';
  /** Additional class names */
  className?: string;
  /** Preview URL for IMAGE header (blob URL from local file or uploaded URL) */
  headerImageUrl?: string;
}

const SIZE_CONFIGS = {
  sm: { height: 'h-[400px]', width: 'w-[220px]', border: 'border-[6px]', notch: 'w-24 h-5', aspect: '' },
  md: { height: 'h-[520px]', width: 'w-[260px]', border: 'border-[8px]', notch: 'w-28 h-5', aspect: '' },
  lg: { height: 'h-[600px]', width: 'w-[300px]', border: 'border-[8px]', notch: 'w-32 h-6', aspect: '' },
  adaptive: { height: '', width: 'w-full', border: 'border-[8px]', notch: 'w-32 h-6', aspect: 'aspect-[9/19]' },
};

export const WhatsAppPhonePreview: React.FC<WhatsAppPhonePreviewProps> = ({
  components,
  variables,
  fallbackContent,
  businessName = 'SmartZap Business',
  showEmptyState = true,
  emptyStateMessage = 'Selecione um template',
  size = 'lg',
  className = '',
  headerImageUrl,
}) => {
  const sizeConfig = SIZE_CONFIGS[size];
  const hasContent = components?.length || fallbackContent;

  return (
    <div className={`relative mx-auto border-zinc-800 bg-zinc-950 ${sizeConfig.border} rounded-[2.5rem] ${sizeConfig.height} ${sizeConfig.width} ${sizeConfig.aspect} shadow-2xl flex flex-col overflow-hidden ${className}`}>
      {/* Notch */}
      <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 ${sizeConfig.notch} bg-zinc-800 rounded-b-xl z-20`}></div>

      {/* WhatsApp Header */}
      <div className="bg-[#202c33] h-20 flex items-end px-4 pb-3 border-b border-[#111b21] shrink-0 z-10">
        <div className="flex items-center gap-3 w-full">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-gray-100 text-sm font-medium leading-none">{businessName}</p>
            <p className="text-[10px] text-gray-400 mt-1">Conta Comercial</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-[#0b141a] relative overflow-hidden p-4 flex flex-col">
        {/* Chat Background Pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Message Date */}
        <div className="flex justify-center mb-6 mt-2">
          <span className="bg-[#182229] text-[#8696a0] text-[10px] py-1 px-3 rounded-lg font-medium shadow-sm uppercase tracking-wide">
            Hoje
          </span>
        </div>

        {/* Message Content */}
        {hasContent ? (
          <MessageBubble
            components={components}
            variables={variables}
            fallbackContent={fallbackContent}
            headerImageUrl={headerImageUrl}
          />
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-xs gap-2 opacity-50">
            <div className="w-12 h-12 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <span>{emptyStateMessage}</span>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="bg-[#202c33] h-14 flex items-center px-2 gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-[#8696a0]">
          <span className="text-xl">+</span>
        </div>
        <div className="flex-1 h-9 bg-[#2a3942] rounded-lg px-3 flex items-center text-[#8696a0] text-xs">
          Mensagem
        </div>
        <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white">
          <Zap size={14} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPACT PREVIEW (without phone mockup)
// ============================================================================

interface CompactPreviewProps {
  /** Template components */
  components?: TemplateComponent[];
  /** Variables for replacement */
  variables?: string[];
  /** Fallback content */
  fallbackContent?: string;
  /** Additional class */
  className?: string;
}

export const CompactPreview: React.FC<CompactPreviewProps> = ({
  components,
  variables,
  fallbackContent,
  className = '',
}) => {
  return (
    <div className={`bg-[#0b141a] rounded-lg p-4 ${className}`}>
      <MessageBubble
        components={components}
        variables={variables}
        fallbackContent={fallbackContent}
      />
    </div>
  );
};

export default WhatsAppPhonePreview;
