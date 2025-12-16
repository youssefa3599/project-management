import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import ChatPage from './ChatPage';

// ============================================
// SETUP - Mock everything we need
// ============================================

// Mock scrollIntoView (not available in tests)
Element.prototype.scrollIntoView = vi.fn();

// Mock axios for API calls
vi.mock('axios');
const mockedAxios = axios as any;

// Mock socket connection
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

vi.mock('../utils/socket', () => ({
  connectSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

// Mock the Goals component (we're not testing it here)
vi.mock('../components/TaskChatGoals', () => ({
  default: () => <div data-testid="task-goals">Task Goals</div>,
}));

// Mock the message sending hook
vi.mock('../hooks/useAddTaskMessage', () => ({
  default: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock the logged-in user
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      _id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    },
    token: 'test-token',
  })),
}));

// ============================================
// TEST DATA
// ============================================

const sampleMessages = [
  {
    _id: 'msg-1',
    sender: {
      _id: 'user-456',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
    content: 'Hello everyone!',
    createdAt: '2025-01-01T10:00:00Z',
    status: 'sent',
  },
  {
    _id: 'msg-2',
    sender: {
      _id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    },
    content: 'Hi Jane!',
    createdAt: '2025-01-01T10:01:00Z',
    status: 'sent',
  },
];

// ============================================
// HELPER FUNCTION
// ============================================

function renderChatPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/chat/task-123']}>
        <Routes>
          <Route path="/chat/:taskId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ============================================
// TESTS - Start Simple!
// ============================================

describe('ChatPage - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return sample messages
    mockedAxios.get.mockResolvedValue({ data: sampleMessages });
  });

  // ==========================================
  // TEST 1: Page Renders
  // ==========================================
  it('should render the chat page', () => {
    renderChatPage();
    
    expect(screen.getByText('Task Chat')).toBeInTheDocument();
  });

  // ==========================================
  // TEST 2: Shows Empty State
  // ==========================================
  it('should show empty state when no messages', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    
    renderChatPage();
    
    await waitFor(() => {
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST 3: Displays Messages
  // ==========================================
  it('should display messages from the API', async () => {
    renderChatPage();
    
    await waitFor(() => {
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      expect(screen.getByText('Hi Jane!')).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST 4: Shows Sender Names
  // ==========================================
  it('should show who sent each message', async () => {
    renderChatPage();
    
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST 5: User Can Type
  // ==========================================
  it('should allow user to type a message', async () => {
    renderChatPage();
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument();
    });
    
    const input = screen.getByPlaceholderText(/Type a message/i);
    await user.type(input, 'Hello World');
    
    expect(input).toHaveValue('Hello World');
  });

  // ==========================================
  // TEST 6: Shows Connection Status
  // ==========================================
  it('should show connection status', async () => {
    renderChatPage();
    
    await waitFor(() => {
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST 7: Shows Task Goals
  // ==========================================
  it('should render task goals component', () => {
    renderChatPage();
    
    expect(screen.getByTestId('task-goals')).toBeInTheDocument();
  });
});