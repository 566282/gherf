import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/investment_model.dart';
import '../models/user_model.dart';

class InvestmentService {
  static const _investmentsKey = 'investments';
  static const _transactionsKey = 'transactions';

  Future<List<InvestmentModel>> getUserInvestments(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_investmentsKey);
    if (jsonStr == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonStr);
    return jsonList
        .map((j) => InvestmentModel.fromJson(j))
        .where((i) => i.userId == userId)
        .toList();
  }

  Future<List<InvestmentModel>> getAllInvestments() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_investmentsKey);
    if (jsonStr == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonStr);
    return jsonList.map((j) => InvestmentModel.fromJson(j)).toList();
  }

  Future<InvestmentModel> createInvestment({
    required String userId,
    required String planName,
    required double amount,
    required double returnRate,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final id = 'inv-${DateTime.now().millisecondsSinceEpoch}';
    final now = DateTime.now();
    final investment = InvestmentModel(
      id: id,
      userId: userId,
      planName: planName,
      amount: amount,
      returnRate: returnRate,
      status: 'pending',
      startDate: now,
      endDate: now.add(const Duration(days: 365)),
      currentValue: amount,
    );

    final jsonStr = prefs.getString(_investmentsKey);
    List<dynamic> jsonList = jsonStr != null ? jsonDecode(jsonStr) : [];
    jsonList.add(investment.toJson());
    await prefs.setString(_investmentsKey, jsonEncode(jsonList));

    final txn = TransactionModel(
      id: 'txn-${DateTime.now().millisecondsSinceEpoch}',
      userId: userId,
      type: 'investment',
      amount: amount,
      description: 'Investment in $planName',
      date: now,
      status: 'pending',
    );
    await _saveTransaction(txn);

    return investment;
  }

  Future<void> approveInvestment(String investmentId, String userId, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_investmentsKey);
    if (jsonStr != null) {
      final List<dynamic> jsonList = jsonDecode(jsonStr);
      for (var j in jsonList) {
        if (j['id'] == investmentId) {
          j['status'] = 'active';
          final startDate = DateTime.now();
          j['startDate'] = startDate.toIso8601String();
          j['endDate'] = startDate.add(const Duration(days: 365)).toIso8601String();
          j['currentValue'] = j['amount'];
          break;
        }
      }
      await prefs.setString(_investmentsKey, jsonEncode(jsonList));
    }
    final txnJsonStr = prefs.getString(_transactionsKey);
    if (txnJsonStr != null) {
      final List<dynamic> txnList = jsonDecode(txnJsonStr);
      for (var t in txnList) {
        if (t['userId'] == userId && t['type'] == 'investment' && t['status'] == 'pending' && t['amount'] == amount) {
          t['status'] = 'completed';
          break;
        }
      }
      await prefs.setString(_transactionsKey, jsonEncode(txnList));
    }
    final usersStr = prefs.getString('all_users');
    if (usersStr != null) {
      final List<dynamic> usersList = jsonDecode(usersStr);
      for (var u in usersList) {
        if (u['id'] == userId) {
          u['balance'] = (u['balance'] ?? 0).toDouble() - amount;
          u['totalInvested'] = (u['totalInvested'] ?? 0).toDouble() + amount;
          break;
        }
      }
      await prefs.setString('all_users', jsonEncode(usersList));
    }
    final currentUserStr = prefs.getString('current_user');
    if (currentUserStr != null) {
      final userMap = jsonDecode(currentUserStr);
      if (userMap['id'] == userId) {
        userMap['balance'] = (userMap['balance'] ?? 0).toDouble() - amount;
        userMap['totalInvested'] = (userMap['totalInvested'] ?? 0).toDouble() + amount;
        await prefs.setString('current_user', jsonEncode(userMap));
      }
    }
  }

  Future<void> rejectInvestment(String investmentId, String userId, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_investmentsKey);
    if (jsonStr != null) {
      final List<dynamic> jsonList = jsonDecode(jsonStr);
      for (var j in jsonList) {
        if (j['id'] == investmentId) {
          j['status'] = 'rejected';
          break;
        }
      }
      await prefs.setString(_investmentsKey, jsonEncode(jsonList));
    }
    final txnJsonStr = prefs.getString(_transactionsKey);
    if (txnJsonStr != null) {
      final List<dynamic> txnList = jsonDecode(txnJsonStr);
      for (var t in txnList) {
        if (t['userId'] == userId && t['type'] == 'investment' && t['status'] == 'pending' && t['amount'] == amount) {
          t['status'] = 'rejected';
          break;
        }
      }
      await prefs.setString(_transactionsKey, jsonEncode(txnList));
    }
  }

  Future<void> createWithdrawalRequest({required String userId, required double amount}) async {
    final txn = TransactionModel(
      id: 'txn-${DateTime.now().millisecondsSinceEpoch}',
      userId: userId,
      type: 'withdrawal',
      amount: amount,
      description: 'Withdrawal request',
      date: DateTime.now(),
      status: 'pending',
    );
    await _saveTransaction(txn);
  }

  Future<void> approveWithdrawal(String userId, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final txnJsonStr = prefs.getString(_transactionsKey);
    if (txnJsonStr != null) {
      final List<dynamic> txnList = jsonDecode(txnJsonStr);
      for (var t in txnList) {
        if (t['userId'] == userId && t['type'] == 'withdrawal' && t['status'] == 'pending' && t['amount'] == amount) {
          t['status'] = 'completed';
          break;
        }
      }
      await prefs.setString(_transactionsKey, jsonEncode(txnList));
    }
    final usersStr = prefs.getString('all_users');
    if (usersStr != null) {
      final List<dynamic> usersList = jsonDecode(usersStr);
      for (var u in usersList) {
        if (u['id'] == userId) {
          u['balance'] = (u['balance'] ?? 0).toDouble() - amount;
          break;
        }
      }
      await prefs.setString('all_users', jsonEncode(usersList));
    }
    final currentUserStr = prefs.getString('current_user');
    if (currentUserStr != null) {
      final userMap = jsonDecode(currentUserStr);
      if (userMap['id'] == userId) {
        userMap['balance'] = (userMap['balance'] ?? 0).toDouble() - amount;
        await prefs.setString('current_user', jsonEncode(userMap));
      }
    }
  }

  Future<void> rejectWithdrawal(String userId, double amount) async {
    final prefs = await SharedPreferences.getInstance();
    final txnJsonStr = prefs.getString(_transactionsKey);
    if (txnJsonStr != null) {
      final List<dynamic> txnList = jsonDecode(txnJsonStr);
      for (var t in txnList) {
        if (t['userId'] == userId && t['type'] == 'withdrawal' && t['status'] == 'pending' && t['amount'] == amount) {
          t['status'] = 'rejected';
          break;
        }
      }
      await prefs.setString(_transactionsKey, jsonEncode(txnList));
    }
  }

  Future<void> _saveTransaction(TransactionModel txn) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_transactionsKey);
    List<dynamic> jsonList = jsonStr != null ? jsonDecode(jsonStr) : [];
    jsonList.add(txn.toJson());
    await prefs.setString(_transactionsKey, jsonEncode(jsonList));
  }

  Future<List<TransactionModel>> getUserTransactions(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_transactionsKey);
    if (jsonStr == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonStr);
    return jsonList
        .map((j) => TransactionModel.fromJson(j))
        .where((t) => t.userId == userId)
        .toList();
  }

  Future<List<TransactionModel>> getAllTransactions() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_transactionsKey);
    if (jsonStr == null) return [];
    final List<dynamic> jsonList = jsonDecode(jsonStr);
    return jsonList.map((j) => TransactionModel.fromJson(j)).toList();
  }

  Future<UserModel> updateUserBalance(String userId, double newBalance) async {
    final prefs = await SharedPreferences.getInstance();
    final usersStr = prefs.getString('all_users');
    if (usersStr != null) {
      final List<dynamic> usersList = jsonDecode(usersStr);
      for (var u in usersList) {
        if (u['id'] == userId) {
          u['balance'] = newBalance;
          break;
        }
      }
      await prefs.setString('all_users', jsonEncode(usersList));
    }
    final currentUserStr = prefs.getString('current_user');
    if (currentUserStr != null) {
      final userMap = jsonDecode(currentUserStr);
      if (userMap['id'] == userId) {
        userMap['balance'] = newBalance;
        await prefs.setString('current_user', jsonEncode(userMap));
        return UserModel.fromJson(userMap);
      }
    }
    throw Exception('User not found');
  }
}
