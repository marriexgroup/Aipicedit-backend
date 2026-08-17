const adminController = require('../controllers/admin.controller');
const { User } = require('../db');

jest.mock('../db', () => {
  return {
    User: {
      findById: jest.fn(),
    },
  };
});

jest.mock('../services/s3.service', () => {
  return {
    clearBucket: jest.fn(),
  };
});

describe('adminController.updateUserBalance', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { userId: '123' },
      body: { balance: 150.50 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should update user balance and accounttype to paid if balance > 0', async () => {
    const mockUser = {
      _id: '123',
      username: 'testuser',
      accountbalance: 10,
      accounttype: 'free',
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById.mockResolvedValue(mockUser);

    await adminController.updateUserBalance(req, res);

    expect(User.findById).toHaveBeenCalledWith('123');
    expect(mockUser.accountbalance).toBe(150.50);
    expect(mockUser.accounttype).toBe('paid');
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'User balance updated successfully',
      user: {
        _id: '123',
        username: 'testuser',
        accountbalance: 150.50,
        accounttype: 'paid'
      }
    });
  });

  it('should return 400 if balance is missing or not a number', async () => {
    req.body.balance = 'not-a-number';

    await adminController.updateUserBalance(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'balance is required and must be a number' });
  });

  it('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    await adminController.updateUserBalance(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('adminController.clearS3Bucket', () => {
  let req, res;
  const s3Service = require('../services/s3.service');

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should clear S3 bucket and return success and count', async () => {
    s3Service.clearBucket.mockResolvedValue({ success: true, deletedCount: 42 });

    await adminController.clearS3Bucket(req, res);

    expect(s3Service.clearBucket).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Successfully cleared 42 files from S3 bucket.',
      deletedCount: 42
    });
  });

  it('should return 500 error if s3Service fails', async () => {
    s3Service.clearBucket.mockRejectedValue(new Error('S3 error'));

    await adminController.clearS3Bucket(req, res);

    expect(s3Service.clearBucket).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'S3 error' });
  });
});

