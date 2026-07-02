class InvestmentModel {
  final String id;
  final String userId;
  final String planName;
  final double amount;
  final double returnRate;
  final String status;
  final DateTime startDate;
  final DateTime endDate;
  final double currentValue;

  InvestmentModel({
    required this.id,
    required this.userId,
    required this.planName,
    required this.amount,
    required this.returnRate,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.currentValue,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'planName': planName,
        'amount': amount,
        'returnRate': returnRate,
        'status': status,
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'currentValue': currentValue,
      };

  factory InvestmentModel.fromJson(Map<String, dynamic> json) => InvestmentModel(
        id: json['id'] ?? '',
        userId: json['userId'] ?? '',
        planName: json['planName'] ?? '',
        amount: (json['amount'] ?? 0).toDouble(),
        returnRate: (json['returnRate'] ?? 0).toDouble(),
        status: json['status'] ?? 'active',
        startDate: DateTime.tryParse(json['startDate'] ?? '') ?? DateTime.now(),
        endDate: DateTime.tryParse(json['endDate'] ?? '') ?? DateTime.now(),
        currentValue: (json['currentValue'] ?? 0).toDouble(),
      );
}

class TransactionModel {
  final String id;
  final String userId;
  final String type;
  final double amount;
  final String description;
  final DateTime date;
  final String status;

  TransactionModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.description,
    required this.date,
    required this.status,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'type': type,
        'amount': amount,
        'description': description,
        'date': date.toIso8601String(),
        'status': status,
      };

  factory TransactionModel.fromJson(Map<String, dynamic> json) => TransactionModel(
        id: json['id'] ?? '',
        userId: json['userId'] ?? '',
        type: json['type'] ?? '',
        amount: (json['amount'] ?? 0).toDouble(),
        description: json['description'] ?? '',
        date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
        status: json['status'] ?? 'completed',
      );
}
