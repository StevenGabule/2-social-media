const mongoose = require('mongoose');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');

exports.getUsers = async (req, res) => {
    const users = await User.find().select('_id name email avatar createdAt updatedAt');
    await res.json(users);
};

exports.getAuthUser = async (req, res) => {
    if (!req.isAuthUser) {
        res.status(403).json({
            message: "You are unauthenticated. Please sign in or sign up"
        });
        return res.redirect('/signin');
    }
    await res.json(req.user);
};

exports.getUserById = async (req, res, next, id) => {
    if (id !== null) {
        const user = await User.findOne({_id: id});
        req.profile = user;

        const profileId = mongoose.Types.ObjectId(req.profile._id);

        if (req.user && profileId.equals(req.user._id)) {
            req.isAuthUser = true;
            return next();
        }
    }
    next();
};

exports.getUserProfile = (req, res) => {
    if (!req.profile) {
        return res.status(404).json({
            message: "No user found"
        });
    }
    res.json(req.profile);
};

exports.getUserFeed = async (req, res) => {
    const {following, _id} = req.profile;
    following.push(_id);
    const users = await User.find({_id: {$nin: following}}).select('_id name avatar');
    await res.json(users);
};

const avatarUploadOptions = {
    storage: multer.memoryStorage(),
    limits: {
        // storing images files up to 1mb
        fileSize: 1024 * 1024
    },

    fileFilter: (req, file, next) => {
        if (file.mimetype.startsWith('image/')) {
            next(null, true);
        } else {
            next(null, false);
        }
    }
};


exports.uploadAvatar = multer(avatarUploadOptions).single('avatar');

exports.resizeAvatar = async (req, res, next) => {
    if (!req.file) {
        return next();
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.avatar = `/static/uploads/avatars/${req.user.name}-${Date.now()}.${extension}`;
    const image = await jimp.read(req.file.buffer);
    await image.resize(250, jimp.AUTO);
    await image.write(`./${req.body.avatar}`);
    next();
};

exports.updateUser = async (req, res) => {
    req.body.updatedAt = new Date().toISOString();
    const updatedUser = await User.findOneAndUpdate(
        {_id: req.user._id},
        {$set: req.body},
        {new: true, runValidators: true}
    );
    await res.json(updatedUser);
};

exports.deleteUser = async (req, res) => {
    const {userId} = req.params;
    const _id = mongoose.Types.ObjectId(userId);
    if (!req.isAuthUser) {
        return res.status(400).json({message: "You are not authorized to perform this action!"});
    }
    const deleteUser = await User.findOneAndDelete({_id});
    await res.json(deleteUser);
};

exports.addFollowing = async (req, res, next) => {
    const {followId} = req.body;
    await User.findOneAndUpdate(
        {_id: req.user._id},
        {$push: {following: followId}}
    );
    next();
};

exports.addFollower = async (req, res) => {
    const {followId} = req.body;
    const user = await User.findOneAndUpdate(
        {_id: followId},
        {$push: {followers: req.user._id}},
        {new: true}
    );
    await res.json(user)
};

exports.deleteFollowing = async (req, res, next) => {
    const {followId} = req.body;
    await User.findOneAndUpdate(
        {_id: req.user._id},
        {$pull: {following: followId}}
    );
    next();
};

exports.deleteFollower = async (req, res) => {
    const {followId} = req.body;
    const user = await User.findOneAndUpdate(
        {_id: followId},
        {$pull: {followers: req.user._id}},
        {new: true}
    );
    await res.json(user)
};
