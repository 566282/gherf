import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'src/auth/auth_screens.dart';
import 'src/dashboard/user_dashboard.dart';
import 'src/admin/admin_dashboard.dart';
import 'src/services/auth_service.dart';
import 'src/shared/app_colors.dart';

final _authService = AuthService();

Future<String?> _redirect(BuildContext context, GoRouterState state) async {
  final user = await _authService.getCurrentUser();
  final isAuthRoute = state.matchedLocation == '/login' ||
      state.matchedLocation == '/signup';
  final isAdminRoute = state.matchedLocation.startsWith('/admin');
  final isApprovalRoute = state.matchedLocation == '/approval-pending';

  if (user == null && !isAuthRoute && !isApprovalRoute) return '/login';
  if (user != null && isAuthRoute) {
    if (!user.isApproved) return '/approval-pending';
    if (user.isRestricted) return '/login';
    return user.isAdmin ? '/admin' : '/dashboard';
  }
  if (user != null && isApprovalRoute && user.isApproved) {
    return user.isAdmin ? '/admin' : '/dashboard';
  }
  if (isAdminRoute && (user == null || !user.isAdmin)) return '/login';
  return null;
}

final appRouter = GoRouter(
  redirect: _redirect,
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => const SignUpScreen(),
    ),
    GoRoute(
      path: '/approval-pending',
      builder: (context, state) => const ApprovalPendingScreen(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const UserDashboard(),
    ),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminDashboard(),
    ),
  ],
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const InvestmentPwaApp());
}

class InvestmentPwaApp extends StatelessWidget {
  const InvestmentPwaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'InvestPro - Investment Platform',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: ColorScheme.dark(
          primary: AppColors.primary,
          secondary: AppColors.accent,
          surface: AppColors.surface,
          error: AppColors.error,
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
        useMaterial3: true,
      ),
      routerConfig: appRouter,
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnim;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _scaleAnim = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _controller.forward();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 2000));
    if (!mounted) return;
    final user = await _authService.getCurrentUser();
    if (!mounted) return;
    if (user != null) {
      if (!user.isApproved) {
        if (mounted) context.go('/approval-pending');
      } else if (user.isRestricted) {
        if (mounted) context.go('/login');
      } else if (user.isAdmin) {
        if (mounted) context.go('/admin');
      } else {
        if (mounted) context.go('/dashboard');
      }
    } else {
      if (mounted) context.go('/login');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: AppColors.darkGradient),
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: ScaleTransition(
              scale: _scaleAnim,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 40,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.trending_up_rounded,
                      color: Colors.black,
                      size: 56,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'InvestPro',
                    style: GoogleFonts.playfairDisplay(
                      color: AppColors.textPrimary,
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Smart Investment Platform',
                    style: GoogleFonts.inter(
                      color: AppColors.textSecondary,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 40),
                  SizedBox(
                    width: 40,
                    height: 40,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
