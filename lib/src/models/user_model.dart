class UserModel {
  final String id;
  final String fullName;
  final String phoneNumber;
  final String? email;
  final bool isAdmin;
  final double balance;
  final double totalInvested;
  final double totalReturns;
  final String joinedDate;
  final bool isApproved;
  final bool isRestricted;
  final String? restrictionReason;

  UserModel({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    this.email,
    this.isAdmin = false,
    this.balance = 0.0,
    this.totalInvested = 0.0,
    this.totalReturns = 0.0,
    required this.joinedDate,
    this.isApproved = true,
    this.isRestricted = false,
    this.restrictionReason,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'phoneNumber': phoneNumber,
        'email': email,
        'isAdmin': isAdmin,
        'balance': balance,
        'totalInvested': totalInvested,
        'totalReturns': totalReturns,
        'joinedDate': joinedDate,
        'isApproved': isApproved,
        'isRestricted': isRestricted,
        'restrictionReason': restrictionReason,
      };

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] ?? '',
        fullName: json['fullName'] ?? '',
        phoneNumber: json['phoneNumber'] ?? '',
        email: json['email'],
        isAdmin: json['isAdmin'] ?? false,
        balance: (json['balance'] ?? 0).toDouble(),
        totalInvested: (json['totalInvested'] ?? 0).toDouble(),
        totalReturns: (json['totalReturns'] ?? 0).toDouble(),
        joinedDate: json['joinedDate'] ?? '',
        isApproved: json['isApproved'] ?? true,
        isRestricted: json['isRestricted'] ?? false,
        restrictionReason: json['restrictionReason'],
      );

  UserModel copyWith({
    String? id,
    String? fullName,
    String? phoneNumber,
    String? email,
    bool? isAdmin,
    double? balance,
    double? totalInvested,
    double? totalReturns,
    String? joinedDate,
    bool? isApproved,
    bool? isRestricted,
    String? restrictionReason,
  }) {
    return UserModel(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      isAdmin: isAdmin ?? this.isAdmin,
      balance: balance ?? this.balance,
      totalInvested: totalInvested ?? this.totalInvested,
      totalReturns: totalReturns ?? this.totalReturns,
      joinedDate: joinedDate ?? this.joinedDate,
      isApproved: isApproved ?? this.isApproved,
      isRestricted: isRestricted ?? this.isRestricted,
      restrictionReason: restrictionReason ?? this.restrictionReason,
    );
  }
}
