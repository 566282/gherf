import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import '../shared/app_colors.dart';
import '../shared/widgets.dart';
import '../services/auth_service.dart';
import '../services/investment_service.dart';
import '../models/user_model.dart';
import '../models/investment_model.dart';

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({super.key});

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard>
    with TickerProviderStateMixin {
  final _authService = AuthService();
  final _investmentService = InvestmentService();
  UserModel? _admin;
  List<UserModel> _users = [];
  List<InvestmentModel> _allInvestments = [];
  List<TransactionModel> _allTransactions = [];
  bool _isLoading = true;
  int _selectedTab = 0;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _loadData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final user = await _authService.getCurrentUser();
    if (user == null || !user.isAdmin) {
      if (mounted) context.go('/login');
      return;
    }
    final users = await _authService.getAllUsers();
    final investments = await _investmentService.getAllInvestments();
    final transactions = await _investmentService.getAllTransactions();
    setState(() {
      _admin = user;
      _users = users;
      _allInvestments = investments;
      _allTransactions = transactions;
      _isLoading = false;
    });
    _animController.forward();
  }

  Future<void> _logout() async {
    await _authService.logout();
    if (mounted) context.go('/login');
  }

  List<UserModel> get _regularUsers => _users.where((u) => !u.isAdmin).toList();
  List<UserModel> get _pendingUsers => _users.where((u) => !u.isAdmin && !u.isApproved).toList();
  List<UserModel> get _restrictedUsers => _users.where((u) => !u.isAdmin && u.isRestricted).toList();
  List<InvestmentModel> get _pendingInvestments => _allInvestments.where((i) => i.status == 'pending').toList();
  List<TransactionModel> get _pendingWithdrawals => _allTransactions.where((t) => t.type == 'withdrawal' && t.status == 'pending').toList();

  double get _totalUserBalance =>
      _regularUsers.fold(0.0, (sum, u) => sum + u.balance);

  double get _totalInvested =>
      _regularUsers.fold(0.0, (sum, u) => sum + u.totalInvested);

  double get _totalReturns =>
      _regularUsers.fold(0.0, (sum, u) => sum + u.totalReturns);

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: FadeTransition(
        opacity: _animController,
        child: Row(
          children: [
            _buildSidebar(),
            Expanded(
              child: SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeader(),
                      const SizedBox(height: AppSpacing.lg),
                      _buildStatsGrid(),
                      const SizedBox(height: AppSpacing.lg),
                      if (_selectedTab == 0) _buildCharts(),
                      if (_selectedTab == 1) _buildUsersTab(),
                      if (_selectedTab == 2) _buildPendingApprovalsTab(),
                      if (_selectedTab == 3) _buildRestrictedTab(),
                      if (_selectedTab == 4) _buildInvestmentsTab(),
                      if (_selectedTab == 5) _buildTransactionsTab(),
                      if (_selectedTab == 6) _buildWithdrawalRequestsTab(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebar() {
    final items = [
      {'icon': Icons.dashboard_outlined, 'label': 'Overview', 'idx': 0},
      {'icon': Icons.people_outline, 'label': 'Users', 'idx': 1},
      {'icon': Icons.pending_actions, 'label': 'Pending', 'idx': 2, 'badge': _pendingUsers.length},
      {'icon': Icons.block, 'label': 'Restricted', 'idx': 3, 'badge': _restrictedUsers.length},
      {'icon': Icons.trending_up, 'label': 'Investments', 'idx': 4},
      {'icon': Icons.receipt_long_outlined, 'label': 'Transactions', 'idx': 5},
      {'icon': Icons.account_balance_wallet_outlined, 'label': 'Withdrawals', 'idx': 6, 'badge': _pendingWithdrawals.length},
    ];

    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(right: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: const Icon(Icons.admin_panel_settings,
                      color: Colors.black, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Admin Panel',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        _admin?.fullName ?? 'Admin',
                        style: GoogleFonts.inter(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 8),
          ...items.map((item) {
            final isSelected = _selectedTab == item['idx'];
            final badge = item['badge'] as int?;
            return GestureDetector(
              onTap: () {
                setState(() => _selectedTab = item['idx'] as int);
                _loadData();
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm, vertical: 2),
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withOpacity(0.1)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: isSelected
                      ? Border.all(
                          color: AppColors.primary.withOpacity(0.3))
                      : null,
                ),
                child: Row(
                  children: [
                    Icon(
                      item['icon'] as IconData,
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.textMuted,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item['label'] as String,
                        style: GoogleFonts.inter(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textSecondary,
                          fontSize: 13,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                    if (badge != null && badge > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$badge',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: GestureDetector(
              onTap: _logout,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(
                      color: AppColors.error.withOpacity(0.2)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.logout,
                        color: AppColors.error, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Logout',
                      style: GoogleFonts.inter(
                        color: AppColors.error,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Dashboard Overview',
              style: GoogleFonts.playfairDisplay(
                color: AppColors.textPrimary,
                fontSize: 26,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              'Welcome back, ${_admin?.fullName ?? 'Admin'}',
              style: GoogleFonts.inter(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
          ],
        ),
          Row(
            children: [
              GestureDetector(
                onTap: _loadData,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(Icons.refresh,
                      color: AppColors.textSecondary, size: 18),
                ),
              ),
              const SizedBox(width: 8),
              if (_pendingUsers.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  border: Border.all(
                      color: AppColors.warning.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.pending_actions,
                        color: AppColors.warning, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '${_pendingUsers.length} pending',
                      style: GoogleFonts.inter(
                        color: AppColors.warning,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(AppRadius.full),
                border: Border.all(
                    color: AppColors.success.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'System Online',
                    style: GoogleFonts.inter(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatsGrid() {
    final currencyFmt = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    return GridView.count(
      crossAxisCount: 4,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.5,
      children: [
        _buildStatCard(
          'Total Users',
          '${_regularUsers.length}',
          Icons.people_outline,
          AppColors.primary,
          '+${((_regularUsers.length * 0.15).toInt())} this month',
        ),
        _buildStatCard(
          'Total Deposits',
          currencyFmt.format(_totalUserBalance),
          Icons.account_balance_wallet_outlined,
          AppColors.accent,
          '+12.5%',
        ),
        _buildStatCard(
          'Total Invested',
          currencyFmt.format(_totalInvested),
          Icons.trending_up,
          AppColors.warning,
          '+8.3%',
        ),
        _buildStatCard(
          'Total Returns',
          currencyFmt.format(_totalReturns),
          Icons.savings_outlined,
          AppColors.success,
          '+15.2%',
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon,
      Color color, String change) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              Text(
                change,
                style: GoogleFonts.inter(
                  color: AppColors.success,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.inter(
              color: AppColors.textMuted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCharts() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Revenue Overview',
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 220,
                      child: LineChart(
                        LineChartData(
                          gridData: FlGridData(
                            show: true,
                            drawVerticalLine: false,
                            getDrawingHorizontalLine: (value) => FlLine(
                              color: AppColors.border,
                              strokeWidth: 0.5,
                            ),
                          ),
                          titlesData: FlTitlesData(
                            show: true,
                            topTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false)),
                            rightTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false)),
                            leftTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false)),
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                getTitlesWidget: (value, meta) {
                                  const months = [
                                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'
                                  ];
                                  if (value.toInt() >= 0 &&
                                      value.toInt() < months.length) {
                                    return Text(
                                      months[value.toInt()],
                                      style: GoogleFonts.inter(
                                        color: AppColors.textMuted,
                                        fontSize: 11,
                                      ),
                                    );
                                  }
                                  return const Text('');
                                },
                              ),
                            ),
                          ),
                          borderData: FlBorderData(show: false),
                          lineBarsData: [
                            LineChartBarData(
                              spots: const [
                                FlSpot(0, 15000),
                                FlSpot(1, 22000),
                                FlSpot(2, 18000),
                                FlSpot(3, 35000),
                                FlSpot(4, 42000),
                                FlSpot(5, 55000),
                              ],
                              isCurved: true,
                              gradient: AppColors.primaryGradient,
                              barWidth: 3,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  colors: [
                                    AppColors.primary.withOpacity(0.2),
                                    AppColors.primary.withOpacity(0.0),
                                  ],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                            LineChartBarData(
                              spots: const [
                                FlSpot(0, 10000),
                                FlSpot(1, 15000),
                                FlSpot(2, 14000),
                                FlSpot(3, 25000),
                                FlSpot(4, 30000),
                                FlSpot(5, 38000),
                              ],
                              isCurved: true,
                              gradient: AppColors.accentGradient,
                              barWidth: 3,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  colors: [
                                    AppColors.accent.withOpacity(0.2),
                                    AppColors.accent.withOpacity(0.0),
                                  ],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildLegendItem('Revenue', AppColors.primary),
                        const SizedBox(width: 20),
                        _buildLegendItem('Profit', AppColors.accent),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'User Distribution',
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 180,
                      child: PieChart(
                        PieChartData(
                          sectionsSpace: 2,
                          centerSpaceRadius: 50,
                          sections: [
                            PieChartSectionData(
                              color: AppColors.primary,
                              value: 35,
                              title: '35%',
                              radius: 40,
                              titleStyle: GoogleFonts.inter(
                                color: Colors.black,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            PieChartSectionData(
                              color: AppColors.accent,
                              value: 25,
                              title: '25%',
                              radius: 40,
                              titleStyle: GoogleFonts.inter(
                                color: Colors.black,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            PieChartSectionData(
                              color: AppColors.warning,
                              value: 25,
                              title: '25%',
                              radius: 40,
                              titleStyle: GoogleFonts.inter(
                                color: Colors.black,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            PieChartSectionData(
                              color: AppColors.error,
                              value: 15,
                              title: '15%',
                              radius: 40,
                              titleStyle: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildLegendItem('Starter', AppColors.primary),
                    const SizedBox(height: 4),
                    _buildLegendItem('Growth', AppColors.accent),
                    const SizedBox(height: 4),
                    _buildLegendItem('Premium', AppColors.warning),
                    const SizedBox(height: 4),
                    _buildLegendItem('Elite', AppColors.error),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: GoogleFonts.inter(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildUsersTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'All Users (${_regularUsers.length})',
              style: GoogleFonts.playfairDisplay(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    border: Border.all(
                        color: AppColors.success.withOpacity(0.3)),
                  ),
                  child: Text(
                    'Active: ${_regularUsers.where((u) => u.isApproved && !u.isRestricted).length}',
                    style: GoogleFonts.inter(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    border: Border.all(
                        color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Text(
                    'Restricted: ${_restrictedUsers.length}',
                    style: GoogleFonts.inter(
                      color: AppColors.error,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        ..._regularUsers.map((user) => _buildUserCard(user)),
      ],
    );
  }

  Widget _buildUserCard(UserModel user) {
    final isRestricted = user.isRestricted;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: isRestricted
              ? AppColors.error.withOpacity(0.3)
              : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isRestricted
                      ? AppColors.error.withOpacity(0.15)
                      : AppColors.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(
                  isRestricted ? Icons.block : Icons.person,
                  color: isRestricted ? AppColors.error : AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          user.fullName,
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (isRestricted)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.error.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'RESTRICTED',
                              style: GoogleFonts.inter(
                                color: AppColors.error,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                      ],
                    ),
                    Text(
                      '${user.phoneNumber} • ${user.email ?? "No email"}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildUserStat('Balance', '\₦{user.balance.toStringAsFixed(2)}', AppColors.accent),
              ),
              Expanded(
                child: _buildUserStat('Invested', '\₦{user.totalInvested.toStringAsFixed(2)}', AppColors.primary),
              ),
              Expanded(
                child: _buildUserStat('Returns', '\₦{user.totalReturns.toStringAsFixed(2)}', AppColors.success),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                'Joined: ${DateFormat('MMM dd, yyyy').format(DateTime.tryParse(user.joinedDate) ?? DateTime.now())}',
                style: GoogleFonts.inter(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
              const Spacer(),
              if (isRestricted)
                TextButton.icon(
                  onPressed: () => _showUnrestrictDialog(user),
                  icon: Icon(Icons.lock_open, color: AppColors.success, size: 16),
                  label: Text('Restore',
                      style: GoogleFonts.inter(
                          color: AppColors.success, fontSize: 12)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  ),
                )
              else
                TextButton.icon(
                  onPressed: () => _showRestrictDialog(user),
                  icon: Icon(Icons.block, color: AppColors.error, size: 16),
                  label: Text('Restrict',
                      style: GoogleFonts.inter(
                          color: AppColors.error, fontSize: 12)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUserStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            color: AppColors.textMuted,
            fontSize: 10,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.inter(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildPendingApprovalsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Pending Approvals (${_pendingUsers.length})',
          style: GoogleFonts.playfairDisplay(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        if (_pendingUsers.isEmpty)
          GlassCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.check_circle_outline,
                        color: AppColors.success, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'No pending approvals',
                      style: GoogleFonts.inter(
                        color: AppColors.textSecondary,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'All user accounts have been reviewed.',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ..._pendingUsers.map((user) => _buildPendingUserCard(user)),
      ],
    );
  }

  Widget _buildPendingUserCard(UserModel user) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(Icons.person_add,
                    color: AppColors.warning, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.fullName,
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '${user.phoneNumber} • ${user.email ?? "No email"}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      'Registered: ${DateFormat('MMM dd, yyyy HH:mm').format(DateTime.tryParse(user.joinedDate) ?? DateTime.now())}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  text: 'Approve',
                  onPressed: () async {
                    await _authService.approveUser(user.id);
                    _loadData();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${user.fullName} approved',
                              style: GoogleFonts.inter()),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  },
                  isGradient: true,
                  height: 40,
                  icon: Icons.check,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  text: 'Disapprove',
                  onPressed: () async {
                    await _authService.disapproveUser(user.id);
                    _loadData();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${user.fullName} disapproved',
                              style: GoogleFonts.inter()),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  },
                  isOutlined: true,
                  height: 40,
                  icon: Icons.close,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRestrictedTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Restricted Accounts (${_restrictedUsers.length})',
          style: GoogleFonts.playfairDisplay(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        if (_restrictedUsers.isEmpty)
          GlassCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shield_outlined,
                        color: AppColors.success, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'No restricted accounts',
                      style: GoogleFonts.inter(
                        color: AppColors.textSecondary,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ..._restrictedUsers.map((user) => _buildRestrictedUserCard(user)),
      ],
    );
  }

  Widget _buildRestrictedUserCard(UserModel user) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.error.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(Icons.block, color: AppColors.error, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.fullName,
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '${user.phoneNumber} • ${user.email ?? "No email"}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.05),
              borderRadius: BorderRadius.circular(AppRadius.sm),
              border: Border.all(color: AppColors.error.withOpacity(0.15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Restriction Reason:',
                  style: GoogleFonts.inter(
                    color: AppColors.error,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  user.restrictionReason ?? 'No reason provided',
                  style: GoogleFonts.inter(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                'Balance: \₦{user.balance.toStringAsFixed(2)} • Invested: \₦{user.totalInvested.toStringAsFixed(2)}',
                style: GoogleFonts.inter(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
              const Spacer(),
              AppButton(
                text: 'Restore Account',
                onPressed: () => _showUnrestrictDialog(user),
                isGradient: true,
                height: 36,
                icon: Icons.lock_open,
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showRestrictDialog(UserModel user) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        title: Row(
          children: [
            Icon(Icons.block, color: AppColors.error, size: 22),
            const SizedBox(width: 10),
            Text('Restrict ${user.fullName}',
                style: GoogleFonts.inter(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reason for restriction:',
                style: GoogleFonts.inter(
                    color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 8),
            TextField(
              controller: reasonController,
              maxLines: 3,
              style: GoogleFonts.inter(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Enter reason...',
                hintStyle: GoogleFonts.inter(color: AppColors.textMuted),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(color: AppColors.error),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonController.text.trim();
              if (reason.isEmpty) return;
              Navigator.pop(ctx);
              await _authService.restrictUser(user.id, reason: reason);
              _loadData();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${user.fullName} has been restricted',
                        style: GoogleFonts.inter()),
                    backgroundColor: AppColors.error,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
            child: Text('Restrict',
                style: GoogleFonts.inter(
                    color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  void _showUnrestrictDialog(UserModel user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        title: Row(
          children: [
            Icon(Icons.lock_open, color: AppColors.success, size: 22),
            const SizedBox(width: 10),
            Text('Restore ${user.fullName}',
                style: GoogleFonts.inter(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16)),
          ],
        ),
        content: Text(
          'This will remove the restriction on ${user.fullName}\'s account and restore full platform access. A notification will be sent to the user.',
          style: GoogleFonts.inter(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _authService.unrestrictUser(user.id);
              _loadData();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${user.fullName}\'s account restored',
                        style: GoogleFonts.inter()),
                    backgroundColor: AppColors.success,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
            child: Text('Restore',
                style: GoogleFonts.inter(
                    color: Colors.black, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _buildInvestmentsTab() {
    final activeInvestments = _allInvestments.where((i) => i.status != 'pending').toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Investments',
          style: GoogleFonts.playfairDisplay(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        if (_pendingInvestments.isNotEmpty) ...[
          Row(
            children: [
              Icon(Icons.pending_actions, color: AppColors.warning, size: 18),
              const SizedBox(width: 8),
              Text(
                'Pending Approval (${_pendingInvestments.length})',
                style: GoogleFonts.inter(
                  color: AppColors.warning,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._pendingInvestments.map((inv) => _buildPendingInvestmentCard(inv)),
          const SizedBox(height: 24),
        ],
        Text(
          'All Investments (${activeInvestments.length})',
          style: GoogleFonts.inter(
            color: AppColors.textSecondary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        if (_allInvestments.isEmpty)
          GlassCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.trending_up,
                        color: AppColors.textMuted, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'No investments yet',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...activeInvestments.map((inv) {
            final user = _users.where((u) => u.id == inv.userId).firstOrNull;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Icon(Icons.trending_up,
                        color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${inv.planName} Plan',
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          'User: ${user?.fullName ?? 'Unknown'}',
                          style: GoogleFonts.inter(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '\₦{inv.amount.toStringAsFixed(2)}',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: inv.status == 'active'
                              ? AppColors.success.withOpacity(0.15)
                              : inv.status == 'rejected'
                                  ? AppColors.error.withOpacity(0.15)
                                  : AppColors.warning.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: Text(
                          inv.status.toUpperCase(),
                          style: GoogleFonts.inter(
                            color: inv.status == 'active'
                                ? AppColors.success
                                : inv.status == 'rejected'
                                    ? AppColors.error
                                    : AppColors.warning,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildPendingInvestmentCard(InvestmentModel inv) {
    final user = _users.where((u) => u.id == inv.userId).firstOrNull;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(Icons.pending_actions,
                    color: AppColors.warning, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${inv.planName} Plan',
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'User: ${user?.fullName ?? 'Unknown'}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      'User Balance: \₦${user?.balance.toStringAsFixed(2) ?? '0.00'}',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '\₦{inv.amount.toStringAsFixed(2)}',
                style: GoogleFonts.inter(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  text: 'Approve',
                  onPressed: () async {
                    if (user != null && user.balance < inv.amount) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('User has insufficient balance',
                              style: GoogleFonts.inter()),
                          backgroundColor: AppColors.error,
                        ),
                      );
                      return;
                    }
                    await _investmentService.approveInvestment(inv.id, inv.userId, inv.amount);
                    await _authService.addNotification(
                      inv.userId,
                      'Investment Approved',
                      'Your ${inv.planName} investment of \₦${inv.amount.toStringAsFixed(2)} has been approved.',
                    );
                    _loadData();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${inv.planName} investment approved',
                              style: GoogleFonts.inter()),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  },
                  isGradient: true,
                  height: 40,
                  icon: Icons.check,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  text: 'Reject',
                  onPressed: () async {
                    await _investmentService.rejectInvestment(inv.id, inv.userId, inv.amount);
                    await _authService.addNotification(
                      inv.userId,
                      'Investment Rejected',
                      'Your ${inv.planName} investment of \₦${inv.amount.toStringAsFixed(2)} has been rejected. No amount was deducted.',
                    );
                    _loadData();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${inv.planName} investment rejected',
                              style: GoogleFonts.inter()),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  },
                  isOutlined: true,
                  height: 40,
                  icon: Icons.close,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'All Transactions (${_allTransactions.length})',
          style: GoogleFonts.playfairDisplay(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        if (_allTransactions.isEmpty)
          GlassCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.receipt_long_outlined,
                        color: AppColors.textMuted, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'No transactions yet',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ..._allTransactions.map((txn) {
            final user = _users.where((u) => u.id == txn.userId).firstOrNull;
            final isPositive =
                txn.type == 'deposit' || txn.type == 'return';
            final color = isPositive ? AppColors.success : AppColors.error;
            Color statusColor;
            if (txn.status == 'pending') {
              statusColor = AppColors.warning;
            } else if (txn.status == 'rejected') {
              statusColor = AppColors.error;
            } else {
              statusColor = AppColors.textMuted;
            }
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: txn.status == 'pending'
                      ? AppColors.warning.withOpacity(0.3)
                      : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Icon(
                      isPositive
                          ? Icons.arrow_downward_rounded
                          : Icons.arrow_upward_rounded,
                      color: color,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          txn.description,
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          '${user?.fullName ?? 'Unknown'} • ${DateFormat('MMM dd, yyyy').format(txn.date)}',
                          style: GoogleFonts.inter(
                            color: AppColors.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₦${isPositive ? '+' : '-'}\₦{txn.amount.toStringAsFixed(2)}',
                        style: GoogleFonts.inter(
                          color: color,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (txn.status != 'completed')
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                          ),
                          child: Text(
                            txn.status.toUpperCase(),
                            style: GoogleFonts.inter(
                              color: statusColor,
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildWithdrawalRequestsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Withdrawal Requests (${_pendingWithdrawals.length})',
          style: GoogleFonts.playfairDisplay(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        if (_pendingWithdrawals.isEmpty)
          GlassCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.account_balance_wallet_outlined,
                        color: AppColors.success, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      'No pending withdrawal requests',
                      style: GoogleFonts.inter(
                        color: AppColors.textSecondary,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'All withdrawal requests have been processed.',
                      style: GoogleFonts.inter(
                        color: AppColors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ..._pendingWithdrawals.map((txn) {
            final user = _users.where((u) => u.id == txn.userId).firstOrNull;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.warning.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: Icon(Icons.account_balance_wallet_outlined,
                            color: AppColors.warning, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Withdrawal Request',
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              'User: ${user?.fullName ?? 'Unknown'}',
                              style: GoogleFonts.inter(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              'Available Balance: \₦${user?.balance.toStringAsFixed(2) ?? '0.00'}',
                              style: GoogleFonts.inter(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                            Text(
                              'Requested: ${DateFormat('MMM dd, yyyy HH:mm').format(txn.date)}',
                              style: GoogleFonts.inter(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '\₦{txn.amount.toStringAsFixed(2)}',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          text: 'Approve',
                          onPressed: () async {
                            if (user != null && user.balance < txn.amount) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('User has insufficient balance',
                                      style: GoogleFonts.inter()),
                                  backgroundColor: AppColors.error,
                                ),
                              );
                              return;
                            }
                            await _investmentService.approveWithdrawal(txn.userId, txn.amount);
                            await _authService.addNotification(
                              txn.userId,
                              'Withdrawal Approved',
                              'Your withdrawal request of \₦${txn.amount.toStringAsFixed(2)} has been approved and processed.',
                            );
                            _loadData();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Withdrawal of \₦${txn.amount.toStringAsFixed(2)} approved',
                                      style: GoogleFonts.inter()),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          },
                          isGradient: true,
                          height: 40,
                          icon: Icons.check,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: AppButton(
                          text: 'Reject',
                          onPressed: () async {
                            await _investmentService.rejectWithdrawal(txn.userId, txn.amount);
                            await _authService.addNotification(
                              txn.userId,
                              'Withdrawal Rejected',
                              'Your withdrawal request of \₦${txn.amount.toStringAsFixed(2)} has been rejected. Please contact support.',
                            );
                            _loadData();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Withdrawal of \₦${txn.amount.toStringAsFixed(2)} rejected',
                                      style: GoogleFonts.inter()),
                                  backgroundColor: AppColors.error,
                                ),
                              );
                            }
                          },
                          isOutlined: true,
                          height: 40,
                          icon: Icons.close,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}
