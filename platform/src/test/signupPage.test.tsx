import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SignupPage } from '@/features/auth/pages/SignupPage';

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockState.navigate,
  };
});

vi.mock('@/services/api/auth', () => ({
  signUp: mockState.signUp,
  resendSignupConfirmation: mockState.resendSignupConfirmation,
}));

function renderSignupPage(): void {
  render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  );
}

describe('SignupPage', () => {
  beforeEach(() => {
    mockState.navigate.mockReset();
    mockState.signUp.mockReset();
    mockState.resendSignupConfirmation.mockReset();
  });

  it('shows a post-signup email confirmation state for registered users', async () => {
    mockState.signUp.mockResolvedValue({
      emailConfirmationRequired: true,
      email: 'new.user@example.com',
      role: 'registered_user',
    });

    renderSignupPage();

    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new.user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Registration complete')).toBeInTheDocument();
    expect(screen.getByText('User onboarding next steps')).toBeInTheDocument();
    expect(screen.getByText('new.user@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument();
    expect(mockState.navigate).not.toHaveBeenCalled();
  });

  it('shows advertiser-specific next steps and supports resending confirmation', async () => {
    mockState.signUp.mockResolvedValue({
      emailConfirmationRequired: true,
      email: 'ads@example.com',
      role: 'advertiser',
    });
    mockState.resendSignupConfirmation.mockResolvedValue(undefined);

    renderSignupPage();

    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Advertiser Team' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'ads@example.com' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'advertiser' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Advertiser onboarding next steps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' }));

    expect(mockState.resendSignupConfirmation).toHaveBeenCalledWith('ads@example.com');
    expect(await screen.findByText('A fresh confirmation email has been sent to ads@example.com.')).toBeInTheDocument();
  });
});
