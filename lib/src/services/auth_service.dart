import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/investment_model.dart';

class AuthService {
  static const _userKey = 'current_user';
  static const _usersKey = 'all_users';
  static const _notificationsKey = 'user_notifications';

  Future<void> _saveUsers(List<UserModel> users) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = users.map((u) => u.toJson()).toList();
    await prefs.setString(_usersKey, jsonEncode(jsonList));
  }

  Future<List<UserModel>> _getUsers() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_usersKey);
    if (jsonStr == null) {
      final seedUsers = _createSeedUsers();
      await _saveUsers(seedUsers);
      await _seedInvestments();
      await _seedTransactions();
      return seedUsers;
    }
    final List<dynamic> jsonList = jsonDecode(jsonStr);
    return jsonList.map((j) => UserModel.fromJson(j)).toList();
  }

  List<UserModel> _createSeedUsers() {
    final now = DateTime.now();
    return [
      UserModel(
        id: 'admin-001',
        fullName: 'Platform Admin',
        phoneNumber: '+1234567890',
        email: 'admin@investplatform.com',
        isAdmin: true,
        balance: 999999.99,
        totalInvested: 0,
        totalReturns: 0,
        joinedDate: now.subtract(const Duration(days: 365)).toIso8601String(),
      ),
      UserModel(
        id: 'user-001',
        fullName: 'James Mitchell',
        phoneNumber: '+14155551001',
        email: 'james.mitchell@email.com',
        isAdmin: false,
        balance: 48500.00,
        totalInvested: 125000.00,
        totalReturns: 32750.00,
        joinedDate: now.subtract(const Duration(days: 180)).toIso8601String(),
        isApproved: true,
      ),
      UserModel(
        id: 'user-002',
        fullName: 'Sarah Chen',
        phoneNumber: '+14155551002',
        email: 'sarah.chen@email.com',
        isAdmin: false,
        balance: 22300.00,
        totalInvested: 78000.00,
        totalReturns: 18420.00,
        joinedDate: now.subtract(const Duration(days: 120)).toIso8601String(),
        isApproved: true,
      ),
      UserModel(
        id: 'user-003',
        fullName: 'Marcus Williams',
        phoneNumber: '+14155551003',
        email: 'marcus.w@email.com',
        isAdmin: false,
        balance: 15600.00,
        totalInvested: 52000.00,
        totalReturns: 8900.00,
        joinedDate: now.subtract(const Duration(days: 90)).toIso8601String(),
        isApproved: true,
      ),
      UserModel(
        id: 'user-004',
        fullName: 'Emily Rodriguez',
        phoneNumber: '+14155551004',
        email: 'emily.r@email.com',
        isAdmin: false,
        balance: 8750.00,
        totalInvested: 35000.00,
        totalReturns: 5200.00,
        joinedDate: now.subtract(const Duration(days: 60)).toIso8601String(),
        isApproved: true,
      ),
      UserModel(
        id: 'user-005',
        fullName: 'David Kim',
        phoneNumber: '+14155551005',
        email: 'david.kim@email.com',
        isAdmin: false,
        balance: 3200.00,
        totalInvested: 15000.00,
        totalReturns: 2100.00,
        joinedDate: now.subtract(const Duration(days: 30)).toIso8601String(),
        isApproved: true,
      ),
      UserModel(
        id: 'user-006',
        fullName: 'Lisa Thompson',
        phoneNumber: '+14155551006',
        email: 'lisa.t@email.com',
        isAdmin: false,
        balance: 5400.00,
        totalInvested: 22000.00,
        totalReturns: 3600.00,
        joinedDate: now.subtract(const Duration(days: 45)).toIso8601String(),
        isApproved: true,
        isRestricted: true,
        restrictionReason: 'Suspicious activity detected. Account temporarily restricted pending verification.',
      ),
      UserModel(
        id: 'user-007',
        fullName: 'New User Pending',
        phoneNumber: '+14155551007',
        email: 'newuser@email.com',
        isAdmin: false,
        balance: 1000.00,
        totalInvested: 0,
        totalReturns: 0,
        joinedDate: now.subtract(const Duration(days: 1)).toIso8601String(),
        isApproved: false,
      ),
    ];
  }

  Future<void> _seedInvestments() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString('investments');
    if (existing != null) return;

    final now = DateTime.now();
    final investments = [
      InvestmentModel(id: 'inv-1001', userId: 'user-001', planName: 'Growth', amount: 25000, returnRate: 12.0, status: 'active', startDate: now.subtract(const Duration(days: 170)), endDate: now.add(const Duration(days: 195)), currentValue: 28200),
      InvestmentModel(id: 'inv-1002', userId: 'user-001', planName: 'Premium', amount: 50000, returnRate: 18.0, status: 'active', startDate: now.subtract(const Duration(days: 120)), endDate: now.add(const Duration(days: 245)), currentValue: 58500),
      InvestmentModel(id: 'inv-1003', userId: 'user-001', planName: 'Growth', amount: 25000, returnRate: 12.0, status: 'active', startDate: now.subtract(const Duration(days: 60)), endDate: now.add(const Duration(days: 305)), currentValue: 26500),
      InvestmentModel(id: 'inv-1004', userId: 'user-001', planName: 'Elite', amount: 25000, returnRate: 25.0, status: 'active', startDate: now.subtract(const Duration(days: 30)), endDate: now.add(const Duration(days: 335)), currentValue: 26875),
      InvestmentModel(id: 'inv-2001', userId: 'user-002', planName: 'Premium', amount: 35000, returnRate: 18.0, status: 'active', startDate: now.subtract(const Duration(days: 100)), endDate: now.add(const Duration(days: 265)), currentValue: 40250),
      InvestmentModel(id: 'inv-2002', userId: 'user-002', planName: 'Growth', amount: 28000, returnRate: 12.0, status: 'active', startDate: now.subtract(const Duration(days: 80)), endDate: now.add(const Duration(days: 285)), currentValue: 30520),
      InvestmentModel(id: 'inv-2003', userId: 'user-002', planName: 'Starter', amount: 15000, returnRate: 5.0, status: 'active', startDate: now.subtract(const Duration(days: 50)), endDate: now.add(const Duration(days: 315)), currentValue: 15375),
      InvestmentModel(id: 'inv-3001', userId: 'user-003', planName: 'Growth', amount: 22000, returnRate: 12.0, status: 'active', startDate: now.subtract(const Duration(days: 85)), endDate: now.add(const Duration(days: 280)), currentValue: 24420),
      InvestmentModel(id: 'inv-3002', userId: 'user-003', planName: 'Premium', amount: 30000, returnRate: 18.0, status: 'active', startDate: now.subtract(const Duration(days: 40)), endDate: now.add(const Duration(days: 325)), currentValue: 32700),
      InvestmentModel(id: 'inv-4001', userId: 'user-004', planName: 'Starter', amount: 15000, returnRate: 5.0, status: 'active', startDate: now.subtract(const Duration(days: 55)), endDate: now.add(const Duration(days: 310)), currentValue: 15625),
      InvestmentModel(id: 'inv-4002', userId: 'user-004', planName: 'Growth', amount: 20000, returnRate: 12.0, status: 'active', startDate: now.subtract(const Duration(days: 35)), endDate: now.add(const Duration(days: 330)), currentValue: 21400),
      InvestmentModel(id: 'inv-5001', userId: 'user-005', planName: 'Starter', amount: 15000, returnRate: 5.0, status: 'active', startDate: now.subtract(const Duration(days: 25)), endDate: now.add(const Duration(days: 340)), currentValue: 15312),
    ];

    final jsonList = investments.map((i) => i.toJson()).toList();
    await prefs.setString('investments', jsonEncode(jsonList));
  }

  Future<void> _seedTransactions() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString('transactions');
    if (existing != null) return;

    final now = DateTime.now();
    final transactions = [
      TransactionModel(id: 'txn-1001', userId: 'user-001', type: 'deposit', amount: 50000, description: 'Initial deposit', date: now.subtract(const Duration(days: 180)), status: 'completed'),
      TransactionModel(id: 'txn-1002', userId: 'user-001', type: 'investment', amount: 25000, description: 'Investment in Growth', date: now.subtract(const Duration(days: 170)), status: 'completed'),
      TransactionModel(id: 'txn-1003', userId: 'user-001', type: 'investment', amount: 50000, description: 'Investment in Premium', date: now.subtract(const Duration(days: 120)), status: 'completed'),
      TransactionModel(id: 'txn-1004', userId: 'user-001', type: 'return', amount: 3200, description: 'Growth Plan Return', date: now.subtract(const Duration(days: 150)), status: 'completed'),
      TransactionModel(id: 'txn-1005', userId: 'user-001', type: 'investment', amount: 25000, description: 'Investment in Growth', date: now.subtract(const Duration(days: 60)), status: 'completed'),
      TransactionModel(id: 'txn-1006', userId: 'user-001', type: 'return', amount: 5400, description: 'Premium Plan Return', date: now.subtract(const Duration(days: 30)), status: 'completed'),
      TransactionModel(id: 'txn-1007', userId: 'user-001', type: 'investment', amount: 25000, description: 'Investment in Elite', date: now.subtract(const Duration(days: 30)), status: 'completed'),
      TransactionModel(id: 'txn-2001', userId: 'user-002', type: 'deposit', amount: 30000, description: 'Initial deposit', date: now.subtract(const Duration(days: 120)), status: 'completed'),
      TransactionModel(id: 'txn-2002', userId: 'user-002', type: 'investment', amount: 35000, description: 'Investment in Premium', date: now.subtract(const Duration(days: 100)), status: 'completed'),
      TransactionModel(id: 'txn-2003', userId: 'user-002', type: 'deposit', amount: 50000, description: 'Additional deposit', date: now.subtract(const Duration(days: 90)), status: 'completed'),
      TransactionModel(id: 'txn-2004', userId: 'user-002', type: 'investment', amount: 28000, description: 'Investment in Growth', date: now.subtract(const Duration(days: 80)), status: 'completed'),
      TransactionModel(id: 'txn-2005', userId: 'user-002', type: 'return', amount: 2100, description: 'Premium Plan Return', date: now.subtract(const Duration(days: 60)), status: 'completed'),
      TransactionModel(id: 'txn-2006', userId: 'user-002', type: 'investment', amount: 15000, description: 'Investment in Starter', date: now.subtract(const Duration(days: 50)), status: 'completed'),
      TransactionModel(id: 'txn-2007', userId: 'user-002', type: 'return', amount: 1850, description: 'Growth Plan Return', date: now.subtract(const Duration(days: 30)), status: 'completed'),
      TransactionModel(id: 'txn-3001', userId: 'user-003', type: 'deposit', amount: 40000, description: 'Initial deposit', date: now.subtract(const Duration(days: 90)), status: 'completed'),
      TransactionModel(id: 'txn-3002', userId: 'user-003', type: 'investment', amount: 22000, description: 'Investment in Growth', date: now.subtract(const Duration(days: 85)), status: 'completed'),
      TransactionModel(id: 'txn-3003', userId: 'user-003', type: 'deposit', amount: 25000, description: 'Additional deposit', date: now.subtract(const Duration(days: 50)), status: 'completed'),
      TransactionModel(id: 'txn-3004', userId: 'user-003', type: 'investment', amount: 30000, description: 'Investment in Premium', date: now.subtract(const Duration(days: 40)), status: 'completed'),
      TransactionModel(id: 'txn-3005', userId: 'user-003', type: 'return', amount: 1650, description: 'Growth Plan Return', date: now.subtract(const Duration(days: 20)), status: 'completed'),
      TransactionModel(id: 'txn-4001', userId: 'user-004', type: 'deposit', amount: 25000, description: 'Initial deposit', date: now.subtract(const Duration(days: 60)), status: 'completed'),
      TransactionModel(id: 'txn-4002', userId: 'user-004', type: 'investment', amount: 15000, description: 'Investment in Starter', date: now.subtract(const Duration(days: 55)), status: 'completed'),
      TransactionModel(id: 'txn-4003', userId: 'user-004', type: 'deposit', amount: 20000, description: 'Additional deposit', date: now.subtract(const Duration(days: 40)), status: 'completed'),
      TransactionModel(id: 'txn-4004', userId: 'user-004', type: 'investment', amount: 20000, description: 'Investment in Growth', date: now.subtract(const Duration(days: 35)), status: 'completed'),
      TransactionModel(id: 'txn-4005', userId: 'user-004', type: 'return', amount: 800, description: 'Starter Plan Return', date: now.subtract(const Duration(days: 15)), status: 'completed'),
      TransactionModel(id: 'txn-5001', userId: 'user-005', type: 'deposit', amount: 18200, description: 'Initial deposit', date: now.subtract(const Duration(days: 30)), status: 'completed'),
      TransactionModel(id: 'txn-5002', userId: 'user-005', type: 'investment', amount: 15000, description: 'Investment in Starter', date: now.subtract(const Duration(days: 25)), status: 'completed'),
      TransactionModel(id: 'txn-5003', userId: 'user-005', type: 'return', amount: 625, description: 'Starter Plan Return', date: now.subtract(const Duration(days: 10)), status: 'completed'),
    ];

    final jsonList = transactions.map((t) => t.toJson()).toList();
    await prefs.setString('transactions', jsonEncode(jsonList));
  }

  Future<UserModel?> register({
    required String fullName,
    required String phoneNumber,
    String? email,
  }) async {
    final users = await _getUsers();
    final exists = users.any((u) => u.phoneNumber == phoneNumber);
    if (exists) return null;

    final newUser = UserModel(
      id: 'user-${DateTime.now().millisecondsSinceEpoch}',
      fullName: fullName,
      phoneNumber: phoneNumber,
      email: email,
      isAdmin: false,
      balance: 1000.0,
      totalInvested: 0,
      totalReturns: 0,
      joinedDate: DateTime.now().toIso8601String(),
      isApproved: false,
    );

    users.add(newUser);
    await _saveUsers(users);
    await _setCurrentUser(newUser);
    return newUser;
  }

  Future<UserModel?> login({
    required String phoneNumber,
    required String password,
  }) async {
    if (password != 'admin123' && password != 'password') return null;
    final users = await _getUsers();
    final user = users.where((u) => u.phoneNumber == phoneNumber).firstOrNull;
    if (user != null) {
      await _setCurrentUser(user);
      return user;
    }
    return null;
  }

  Future<UserModel?> loginWithEmail({
    required String email,
    required String password,
  }) async {
    if (password != 'admin123' && password != 'password') return null;
    final users = await _getUsers();
    final user = users.where((u) => u.email == email).firstOrNull;
    if (user != null) {
      await _setCurrentUser(user);
      return user;
    }
    return null;
  }

  Future<void> _setCurrentUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_userKey);
    if (jsonStr == null) return null;
    return UserModel.fromJson(jsonDecode(jsonStr));
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }

  Future<List<UserModel>> getAllUsers() async {
    return await _getUsers();
  }

  Future<void> approveUser(String userId) async {
    final users = await _getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == userId) {
        users[i] = users[i].copyWith(isApproved: true);
        break;
      }
    }
    await _saveUsers(users);
    await addNotification(userId, 'Account Approved', 'Your account has been approved by an administrator. You now have full access to the platform.');
  }

  Future<void> disapproveUser(String userId) async {
    final users = await _getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == userId) {
        users[i] = users[i].copyWith(isApproved: false);
        break;
      }
    }
    await _saveUsers(users);
    await addNotification(userId, 'Account Disapproved', 'Your account has been disapproved by an administrator. Please contact support for more information.');
  }

  Future<void> restrictUser(String userId, {String? reason}) async {
    final users = await _getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == userId) {
        users[i] = users[i].copyWith(
          isRestricted: true,
          restrictionReason: reason ?? 'Account restricted by administrator.',
        );
        break;
      }
    }
    await _saveUsers(users);
    await addNotification(userId, 'Account Restricted', 'Your account has been restricted by an administrator.${reason != null ? ' Reason: $reason' : ''} Please contact support.');
  }

  Future<void> unrestrictUser(String userId) async {
    final users = await _getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == userId) {
        users[i] = users[i].copyWith(
          isRestricted: false,
          restrictionReason: null,
        );
        break;
      }
    }
    await _saveUsers(users);
    await addNotification(userId, 'Account Restored', 'Your account restriction has been lifted. You now have full access to the platform.');
  }

  Future<void> addNotification(String userId, String title, String message) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_notificationsKey);
    List<dynamic> allNotifications = jsonStr != null ? jsonDecode(jsonStr) : [];
    allNotifications.add({
      'id': 'notif-${DateTime.now().millisecondsSinceEpoch}',
      'userId': userId,
      'title': title,
      'message': message,
      'date': DateTime.now().toIso8601String(),
      'read': false,
    });
    await prefs.setString(_notificationsKey, jsonEncode(allNotifications));
  }

  Future<List<Map<String, dynamic>>> getUserNotifications(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_notificationsKey);
    if (jsonStr == null) return [];
    final List<dynamic> all = jsonDecode(jsonStr);
    return all.where((n) => n['userId'] == userId).toList().cast<Map<String, dynamic>>();
  }

  Future<void> markNotificationRead(String notificationId) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_notificationsKey);
    if (jsonStr == null) return;
    final List<dynamic> all = jsonDecode(jsonStr);
    for (var n in all) {
      if (n['id'] == notificationId) {
        n['read'] = true;
        break;
      }
    }
    await prefs.setString(_notificationsKey, jsonEncode(all));
  }
}
