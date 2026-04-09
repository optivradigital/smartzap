import React from 'react';

// =============================================================================
// CAMPAIGN & CONTACT TYPES (Existing)
// =============================================================================

export enum CampaignStatus {
  DRAFT = 'Rascunho',
  SCHEDULED = 'Agendado',
  SENDING = 'Enviando',
  COMPLETED = 'Concluído',
  PAUSED = 'Pausado',
  FAILED = 'Falhou'
}

export enum ContactStatus {
  OPT_IN = 'Opt-in',
  OPT_OUT = 'Opt-out',
  UNKNOWN = 'Desconhecido'
}

export enum MessageStatus {
  PENDING = 'Pendente',
  SENT = 'Enviado',
  DELIVERED = 'Entregue',
  READ = 'Lido',
  FAILED = 'Falhou',
  NOT_EXISTS = 'Não existe',
}

export type TemplateCategory = 'MARKETING' | 'UTILIDADE' | 'AUTENTICACAO';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  content: string;
  preview: string;
  lastUpdated: string;
  components?: TemplateComponent[]; // Full components from Meta API
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: TemplateButton[];
  example?: any;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | 'FLOW' | 'CATALOG' | 'MPM' | 'VOICE_CALL';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
  otp_type?: 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';
  flow_id?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  createdAt: string;
  templateName: string;
  templateVariables?: string[];  // Dynamic template variables for {{2}}, {{3}}, etc.
  // Scheduling
  scheduledAt?: string;  // ISO timestamp for scheduled campaigns
  startedAt?: string;    // When campaign actually started sending
  completedAt?: string;  // When campaign finished
  pausedAt?: string;     // When campaign was paused
  // Contacts (for resume functionality and optimistic UI)
  selectedContactIds?: string[];
  pendingContacts?: { name: string; phone: string }[];  // For immediate "Pending" display
}

export interface Contact {
  id: string;
  name?: string;
  phone: string;
  status: ContactStatus;
  tags: string[];
  lastActive: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  campaignId: string;
  contactName: string;
  contactPhone: string;
  status: MessageStatus;
  messageId?: string;      // WhatsApp message ID
  sentAt: string;
  deliveredAt?: string;    // Quando foi entregue
  readAt?: string;         // Quando foi lido
  error?: string;
}

export interface AppSettings {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  isConnected: boolean;
  displayPhoneNumber?: string;
  qualityRating?: string;
  verifiedName?: string;
  testContact?: TestContact;
}

export interface TestContact {
  name?: string;
  phone: string;
}

export interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
}

// Template Workspace Types
export type WorkspaceStatus = 'draft' | 'active' | 'archived';
export type WorkspaceTemplateStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TemplateWorkspace {
  id: string;
  name: string;
  description?: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
  // Computed fields (from API)
  templateCount?: number;
  statusSummary?: {
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

export interface WorkspaceTemplate {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: WorkspaceTemplateStatus;
  metaId?: string;
  metaStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectedReason?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt?: string;
  // Optional components from AI generator
  components?: {
    header?: { format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; text?: string };
    footer?: { text: string };
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  };
}

// =============================================================================
// BATCH SUBMISSION TYPES (Factory)
// =============================================================================

export interface BatchSubmission {
  id: string;
  name: string; // e.g. "Aviso Aula 10/12"
  createdAt: string;
  status: 'processing' | 'completed' | 'partial_error';
  // Stats snapshot
  stats: {
    total: number;
    utility: number;
    marketing: number;
    poll_utility: number; // For "polling" check status
    rejected: number;
    pending: number;
  };
  templates: GeneratedTemplateWithStatus[];
}

export interface GeneratedTemplateWithStatus {
  id: string;
  name: string;
  content: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'; // Current status
  originalCategory: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'; // Intended status
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  metaStatus?: string; // Raw meta status
  rejectionReason?: string;
  generatedAt: string;
  language: string;
  // Components for preview
  header?: { format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; text?: string };
  footer?: { text: string };
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

// =============================================================================
// CHATBOT SYSTEM TYPES
// =============================================================================

// Bot Status
export type BotStatus = 'active' | 'inactive' | 'draft';

// Bot Entity
export interface Bot {
  id: string;
  name: string;
  phoneNumberId: string;
  flowId?: string;
  status: BotStatus;
  welcomeMessage?: string;
  fallbackMessage?: string;
  sessionTimeoutMinutes: number;
  triggerKeywords?: string[];
  createdAt: string;
  updatedAt: string;
  // Computed fields (from API)
  activeConversations?: number;
  totalMessages?: number;
}

// Flow Status
export type FlowStatus = 'draft' | 'published';

// Node Types
export type NodeType =
  | 'start'
  | 'message'
  | 'menu'
  | 'input'
  | 'condition'
  | 'delay'
  | 'handoff'
  | 'ai_agent'
  | 'end'
  | 'image'
  | 'video'
  | 'document'
  | 'audio'
  | 'location'
  | 'carousel'
  | 'cta_url'
  | 'template'
  | 'buttons'
  | 'list'
  | 'contacts'
  | 'sticker'
  | 'reaction';

// Flow Node Position
export interface NodePosition {
  x: number;
  y: number;
}

// Base Node Data
export interface BaseNodeData {
  label?: string;
}

// Start Node Data
export interface StartNodeData extends BaseNodeData {
  triggers?: string[];
  triggerType?: 'any' | 'keyword' | 'webhook';
}

// Message Node Data
export interface MessageNodeData extends BaseNodeData {
  text: string;
  typingDelay?: number;
  previewUrl?: boolean;
}

// Menu Option
export interface MenuOption {
  id: string;
  label: string;
  value: string;
  description?: string;
}

// Menu Node Data
export interface MenuNodeData extends BaseNodeData {
  text: string;
  header?: string;
  footer?: string;
  options: MenuOption[];
}

// Input Validation Type
export type InputValidationType = 'text' | 'email' | 'phone' | 'number' | 'date' | 'custom';

// Input Node Data
export interface InputNodeData extends BaseNodeData {
  prompt: string;
  variableName: string;
  validation?: InputValidationType;
  validationRegex?: string;
  errorMessage?: string;
}

// Condition Operator
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater' | 'less' | 'exists' | 'not_exists';

// Condition Node Data
export interface ConditionNodeData extends BaseNodeData {
  variable: string;
  operator: ConditionOperator;
  value?: string;
}

// Delay Node Data
export interface DelayNodeData extends BaseNodeData {
  seconds: number;
}

// Handoff Node Data
export interface HandoffNodeData extends BaseNodeData {
  message?: string;
  notifyKeyword?: string;
}

// AI Agent Node Data
export interface AIAgentNodeData extends BaseNodeData {
  agentId: string;
  fallbackMessage?: string;
}

// End Node Data
export interface EndNodeData extends BaseNodeData {
  endMessage?: string;
}

// Media Node Data (Image, Video, Audio, Document)
export interface MediaNodeData extends BaseNodeData {
  url?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

// Location Node Data
export interface LocationNodeData extends BaseNodeData {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  requestLocation?: boolean;
}

// Carousel Card
export interface CarouselCard {
  header: {
    type: 'image' | 'video';
    url?: string;
    mediaId?: string;
  };
  body: string;
  ctaUrl: string;
  ctaText: string;
}

// Carousel Node Data
export interface CarouselNodeData extends BaseNodeData {
  cards: CarouselCard[];
}

// CTA URL Node Data
export interface CtaUrlNodeData extends BaseNodeData {
  text: string;
  buttonText: string;
  url: string;
}

// Union of all node data types
export type FlowNodeData =
  | StartNodeData
  | MessageNodeData
  | MenuNodeData
  | InputNodeData
  | ConditionNodeData
  | DelayNodeData
  | HandoffNodeData
  | AIAgentNodeData
  | EndNodeData
  | MediaNodeData
  | LocationNodeData
  | CarouselNodeData
  | CtaUrlNodeData;

// Flow Node
export interface FlowNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: FlowNodeData;
}

// Flow Edge
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: {
    optionId?: string;
    condition?: 'true' | 'false';
  };
}

// Flow Entity
export interface Flow {
  id: string;
  botId: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  version: number;
  status: FlowStatus;
  isMainFlow?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Conversation Status
export type ConversationStatus = 'active' | 'paused' | 'ended';

// Message Direction
export type BotMessageDirection = 'inbound' | 'outbound';

// Message Origin
export type BotMessageOrigin = 'client' | 'bot' | 'operator' | 'ai';

// Message Type
export type BotMessageType =
  | 'text'
  | 'interactive'
  | 'template'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction';

// Bot Message Status
export type BotMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Bot Message
export interface BotMessage {
  id: string;
  conversationId: string;
  waMessageId?: string;
  direction: BotMessageDirection;
  origin: BotMessageOrigin;
  type: BotMessageType;
  content: Record<string, unknown>;
  status: BotMessageStatus;
  error?: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

// Conversation Variable
export interface ConversationVariable {
  key: string;
  value: string;
  collectedAt: string;
}

// Bot Conversation
export interface BotConversation {
  id: string;
  botId: string;
  botName?: string;
  contactPhone: string;
  contactName?: string;
  currentNodeId?: string;
  status: ConversationStatus;
  assignedOperatorId?: string;
  cswStartedAt?: string;
  cswExpiresAt?: string;
  lastMessageAt?: string;
  variables?: Record<string, string>;
  messages?: BotMessage[];
  messageCount?: number;
  lastMessage?: {
    text: string;
    direction: BotMessageDirection;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// AI Agent
export interface AIAgent {
  id: string;
  name: string;
  systemPrompt: string;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash';
  maxTokens: number;
  temperature: number;
  tools?: AITool[];
  createdAt: string;
  updatedAt: string;
}

// AI Tool
export interface AITool {
  id: string;
  agentId: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  webhookUrl: string;
  timeoutMs: number;
  createdAt: string;
}

// Tool Execution Status
export type ToolExecutionStatus = 'pending' | 'success' | 'failed';

// Tool Execution
export interface ToolExecution {
  id: string;
  toolId: string;
  conversationId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  status: ToolExecutionStatus;
  error?: string;
  createdAt: string;
}

// =============================================================================
// FLOW EDITOR STATE (Zustand)
// =============================================================================

export interface FlowEditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  // Actions
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  addNode: (node: FlowNode) => void;
  updateNode: (id: string, data: Partial<FlowNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  reset: () => void;
  loadFlow: (flow: Flow) => void;
}

// =============================================================================
// FLOW ENGINE TYPES
// =============================================================================

// Execution Mode
export type FlowExecutionMode = 'campaign' | 'chatbot';

// Execution Status
export type ExecutionStatus =
  | 'pending'    // Created, waiting to start
  | 'running'    // Currently executing
  | 'paused'     // Paused (campaign) or waiting for input (chatbot)
  | 'completed'  // Finished successfully
  | 'failed'     // Failed with critical error
  | 'cancelled'; // Manually cancelled

// Node Execution Status
export type NodeExecutionStatus =
  | 'pending'    // In queue
  | 'running'    // Currently executing
  | 'completed'  // Finished successfully
  | 'failed'     // Failed to execute
  | 'skipped';   // Skipped (condition not met)

// Flow Execution Entity
export interface FlowExecution {
  id: string;
  flowId: string;
  mode: FlowExecutionMode;
  status: ExecutionStatus;
  triggerSource?: string;  // campaign_id or webhook_message_id

  // Metrics
  contactCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;

  // Timestamps
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;

  // Error info
  errorCode?: number;
  errorMessage?: string;

  // Metadata
  metadata?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

// Node Execution Entity
export interface NodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  contactPhone?: string;
  status: NodeExecutionStatus;

  // Input/Output
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;

  // WhatsApp tracking
  whatsappMessageId?: string;

  // Error info
  errorCode?: number;
  errorMessage?: string;

  // Performance
  durationMs?: number;
  retryCount: number;

  // Timestamps
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Extended NodeType to include new node types
export type ExtendedNodeType = NodeType
  | 'sticker'
  | 'contacts'
  | 'buttons'
  | 'list'
  | 'template'
  | 'reaction'
  | 'jump';

// Sticker Node Data
export interface StickerNodeData extends BaseNodeData {
  mediaId?: string;
  url?: string;
}

// Contacts (vCard) Node Data
export interface ContactsNodeData extends BaseNodeData {
  contacts: Array<{
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: Array<{
      phone: string;
      type?: 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK';
    }>;
    emails?: Array<{
      email: string;
      type?: 'HOME' | 'WORK';
    }>;
  }>;
}

// Reply Buttons Node Data
export interface ButtonsNodeData extends BaseNodeData {
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttons: Array<{
    id: string;
    title: string;  // Max 20 chars
  }>;  // Max 3 buttons
}

// List Message Node Data
export interface ListNodeData extends BaseNodeData {
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttonText: string;  // Max 20 chars
  sections: Array<{
    title?: string;  // Max 24 chars
    rows: Array<{
      id: string;
      title: string;  // Max 24 chars
      description?: string;  // Max 72 chars
    }>;  // Max 10 rows per section
  }>;  // Max 10 sections
}

// Template Node Data
export interface TemplateNodeData extends BaseNodeData {
  templateName: string;
  language: string;
  headerParams?: Array<{
    type: 'text' | 'image' | 'video' | 'document';
    value: string;  // Variable name or URL
  }>;
  bodyParams?: string[];  // Variable names for {{1}}, {{2}}, etc.
  buttonParams?: Array<{
    index: number;
    subType: 'url' | 'quick_reply';
    value: string;
  }>;
}

// Reaction Node Data
export interface ReactionNodeData extends BaseNodeData {
  messageIdVariable?: string;  // Variable containing message ID to react to
  emoji: string;  // Emoji to react with
}

// Jump Node Data
export interface JumpNodeData extends BaseNodeData {
  targetNodeId: string;
}

// Flow Engine Execution Context
export interface FlowEngineContext {
  executionId: string;
  flowId: string;
  mode: FlowExecutionMode;

  // Contact info
  contactPhone: string;
  contactName?: string;

  // Variables
  variables: Record<string, string>;

  // Conversation history (for AI)
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  // WhatsApp credentials
  phoneNumberId: string;
  accessToken: string;

  // Current state
  currentNodeId?: string;
  previousNodeId?: string;
}

// =============================================================================
// SUPABASE REALTIME TYPES
// =============================================================================

/**
 * Tables that have Realtime enabled
 */
export type RealtimeTable =
  | 'campaigns'
  | 'campaign_contacts'
  | 'contacts'
  | 'bot_conversations'
  | 'bot_messages'
  | 'flows'
  | 'flow_executions'
  | 'template_projects'
  | 'template_project_items';

/**
 * Event types for Realtime subscriptions
 */
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Payload received from Supabase Realtime
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  schema: 'public';
  table: RealtimeTable;
  commit_timestamp: string;
  eventType: RealtimeEventType;
  new: T | null;
  old: T | null;
  errors: string[] | null;
}

/**
 * Channel connection status
 */
export type ChannelStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR';

/**
 * Subscription configuration
 */
export interface RealtimeSubscriptionConfig {
  table: RealtimeTable;
  event?: RealtimeEventType;
  filter?: string; // e.g., 'id=eq.123'
}

/**
 * Realtime connection state
 */
export interface RealtimeState {
  isConnected: boolean;
  status: ChannelStatus | null;
  error?: string;
}

export type ProjectStatus = 'draft' | 'submitted' | 'completed';

export interface TemplateProject {
  id: string;
  title: string;
  prompt: string;
  status: ProjectStatus;
  template_count: number;
  approved_count: number;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateProjectItem {
  id: string;
  project_id: string;
  name: string;
  content: string;
  meta_id?: string;
  meta_status?: string;
  header?: any;
  footer?: any;
  buttons?: any;
  category?: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateProjectDTO {
  title: string;
  prompt: string;
  status?: string;
  items: Omit<TemplateProjectItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
}