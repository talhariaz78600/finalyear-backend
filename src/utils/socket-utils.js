const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const moment = require('moment');
const { promisify } = require("util");
const Messages = require('../models/chat/Message');
const Chats = require('../models/chat/Chat');
const Users = require('../models/users/User');
const Reactions = require('../models/chat/Reaction');
// const SpamUsers = require('../models/spamUsers');

const defaultImage = 'https://randomuser.me/api/portraits/men/14.jpg'
const { ObjectId } = require("mongoose").Types
// const { getMessaging } = require("firebase-admin/messaging");
const User = require('../models/users/User');
const Bookings = require('../models/Bookings');
const Notification = require('../models/Notification');

module.exports = {

    authMiddleWareSocket: async (socket, next) => {
        try {
            const authorization = socket.handshake.auth.token;
            if (!authorization) {
                return next(new Error("You must be logged in"));
            }
            console.log("authorization", authorization)
            if (!authorization) {
                return next(new Error("You must be logged in"));
            }
            const decoded = await promisify(jwt.verify)(authorization, process.env.JWT_SECRET);
            const currentUser = decoded?.user;
            if (!currentUser) {
                return next(new Error("Invalid token."));
            }
            const user = await User.findById(currentUser._id)
            console.log(user.fullName); // Should log "First Last"
            if (!user) {
                return next(new Error("User not found."));
            }
            if (user?.role === "admin") {
                const adminUser = await User.findOne({ adminRole: 'admin' });
                socket.user = adminUser;
                socket.subAdmin = user;

            }

            socket.user = user;

            next();
        } catch (error) {
            console.error("JWT decoding error:", error.message);
            return next(new Error(error.message || "Authentication error"));
        }
    },
    getUserNotifications: async (params) => {
        try {
            const { userId, pageNo = 1, recordsPerPage = 10 } = params;
            const skipDocuments = (pageNo - 1) * recordsPerPage;
            const notifications = await Notification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skipDocuments)
                .limit(recordsPerPage);

            if (!notifications) {
                throw new Error("User not found.");
            }

            return notifications;
        } catch (error) {
            console.error("JWT decoding error:", error.message);
            throw new Error(error.message || "Authentication error");
        }
    },
    getUserUnreadNotifications: async (params) => {
        try {
            const { userId } = params;
            const notifications = await Notification.find({ userId })
                .sort({ createdAt: -1 });
            if (!notifications) {
                throw new Error("User not found.");
            }
            return notifications;
        } catch (error) {
            console.error("JWT decoding error:", error.message);
            throw new Error(error.message || "Authentication error");
        }
    },

    readUserNotifications: async (params) => {
        try {
            const { userId } = params;

            await Notification.deleteMany({ userId: userId });
            return true;
        } catch (error) {

            console.error("JWT decoding error:", error.message);

            return false;
        }
    },
    fetchUnseenChats: async (params) => {
        try {
            const { userId, pageNo = 1, recordsPerPage = 10 } = params;
            const skipDocuments = (pageNo - 1) * recordsPerPage;
            const documentsLimit = recordsPerPage;
            const userChatIds = await Chats.find(
                {
                    participants: new ObjectId(userId),
                    notStarted: false,
                    $or: [
                        { userSettings: { $size: 0 } },
                        { 'userSettings.userId': { $ne: userId } },
                        {
                            userSettings: {
                                $elemMatch: {
                                    userId: userId,
                                    $and: [

                                        {
                                            $or: [
                                                { hasUserDeletedChat: false },
                                                { hasUserDeletedChat: { $exists: false } }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ).distinct('_id');

            const unseenChats = await Messages.find({
                chat: { $in: userChatIds },
                $or: [
                    { userSettings: { $exists: false } },
                    { userSettings: { $size: 0 } },
                    {
                        userSettings: {
                            $not: {
                                $elemMatch: {
                                    userId: userId
                                }
                            }
                        }
                    },
                    {
                        userSettings: {
                            $elemMatch: {
                                userId: { $eq: userId },
                                $or: [
                                    { readAt: { $exists: false } },
                                    { readAt: null }
                                ]
                            }
                        }
                    }
                ]
            }).distinct('chat');
            const allUnseenChats = await Chats.find({ _id: { $in: unseenChats } });

            let chats = await Chats.aggregate([
                { $match: { _id: { $in: unseenChats.map(id => new ObjectId(id)) } } },
                {
                    $addFields: {
                        matchingPinnedAt: {
                            $let: {
                                vars: {
                                    matchingUserSetting: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$userSettings",
                                                    as: "setting",
                                                    cond: { $eq: ["$$setting.userId", new ObjectId(userId)] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        sortPriority: {
                            $ifNull: ["$lastMessageSentAt"]
                        }
                    }
                },
                { $sort: { sortPriority: -1 } },
                { $skip: skipDocuments },
                { $limit: documentsLimit },
                {
                    $lookup: {
                        from: "users",
                        localField: "participants",
                        foreignField: "_id",
                        as: "participants"
                    }
                },
                {
                    $lookup: {
                        from: "messages",
                        localField: "lastMessage",
                        foreignField: "_id",
                        as: "lastMessage"
                    }
                },
                {
                    $unwind: {
                        path: "$lastMessage",
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]);

            if (chats?.length) {
                chats = await Promise.all(chats?.map(async chat => {
                    const unreadCount = await Messages.countDocuments({
                        chat: { $in: chat?._id },
                        $or: [
                            { userSettings: { $size: 0 } },
                            { 'userSettings.userId': { $ne: userId } },
                            {
                                userSettings: {
                                    $elemMatch: {
                                        userId: userId,
                                        $or: [
                                            { readAt: null },
                                            { readAt: { $exists: false } }
                                        ]
                                    }
                                }
                            }
                        ]
                    });
                    console.log('chat?.participants?.find(participant => participant._id !== userId)[0]?.Username', chat?.participants?.find(participant => participant._id?.toString() !== userId?.toString())?.Username)
                    const userSettings = chat?.userSettings?.find(setting => setting?.userId?.toString?.() === userId?.toString?.());
                    const displayPicture = chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.profilePicture ?? defaultImage;
                    const receiverId = chat?.participants?.find(participant => participant?._id.toString() !== userId)?._id.toString();
                    const messageDeliveryStatus = module.exports.msgDeliveryStatus({ userId, chat }) || {};
                    const chatDisplayInfo = {
                        chatId: chat?._id,
                        chatName: chat?.groupName || chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.fullName,
                        displayPicture,
                        latestMessage: chat?.lastMessage?.content,
                        latesMessageId: chat?.lastMessage?._id,
                        latestMessageType: chat?.lastMessage?.contentType,
                        contentDescriptionType: chat?.lastMessage?.contentDescriptionType ?? 'text',
                        fileSize: chat?.lastMessage?.fileSize ?? '',
                        latestMessageSentAt: chat?.lastMessageSentAt ?? chat?.lastMessage?.createdAt,
                        latestMessageTitle: chat?.lastMessage?.title ?? '',
                        latestMessageDescription: chat?.lastMessage?.description ?? '',

                        unreadCount: unreadCount || 0,
                        receiverId,
                        ...(Object.keys(messageDeliveryStatus || {})?.length && { ...messageDeliveryStatus }),
                    }
                    return chatDisplayInfo;
                }));

                chats = chats?.sort((a, b) => b?.pinnedAt - a?.pinnedAt);
            }
            const allUnseenChatIds = allUnseenChats?.map(chat => chat?._id);
            module.exports.updateDeliveredAt({ chatIds: allUnseenChatIds, userId });
            const response = {
                pageNo,
                recordsPerPage,
                totalRecords: unseenChats?.length,
                chats,
            }
            return response;
        } catch (error) {
            console.error("Error fetching unseen chats:".red.bold, error?.stack);
            return [];
        }
    },

    updateDeliveredAt: async (params) => {
        try {
            const { chatIds, userId } = params;
            // Update existing entries
            await Messages.updateMany(
                {
                    chat: { $in: chatIds },
                    sender: { $ne: userId },
                    userSettings: {
                        $elemMatch: {
                            userId: userId,
                            $or: [
                                { deliveredAt: { $exists: false } },
                                { deliveredAt: null },
                            ]

                        }
                    }
                },
                {
                    $set: { 'userSettings.$.deliveredAt': new Date() }
                }
            );

            // Add new entries if none exist
            await Messages.updateMany(
                {
                    chat: { $in: chatIds },
                    sender: { $ne: userId },
                    'userSettings.userId': { $ne: userId }
                },
                {
                    $push: {
                        userSettings: {
                            userId: userId,
                            deliveredAt: new Date()
                        }
                    }
                }
            );
        } catch (error) {
            console.log(`Got error in [updateDeliveredAt] for userId ${params?.userId} that is ${JSON.stringify(error?.stack)}`);
        }

    },

    updateReadAt: async (params) => {
        try {
            const { chatId, userId, messageIds } = params;
            console.log(`updateReadAt called with params ${JSON.stringify(params)}`);
            // Update existing entries
            const updatedMessagesResponse = await Messages.updateMany(
                {
                    _id: { $in: messageIds },
                    chat: chatId,
                    userSettings: {
                        $elemMatch: {
                            userId: userId,
                            $or: [
                                { readAt: { $exists: false } },
                                { readAt: null }
                            ]

                        }
                    }
                },
                {
                    $set: { 'userSettings.$.readAt': new Date() }
                }
            );
            console.log(`Got updatedMessagesResponse that is ${JSON.stringify(updatedMessagesResponse)}`);
            // Add new entries if none exist
            const newEntryResponse = await Messages.updateMany(
                {
                    _id: { $in: messageIds },
                    chat: { $in: chatId },
                    'userSettings.userId': { $ne: userId }
                },
                {
                    $push: {
                        userSettings: {
                            userId: userId,
                            readAt: new Date(),
                            deliveredAt: new Date()
                        }
                    }
                }
            );
            console.log(`Got response of updatedMessagesResponse that is ${JSON.stringify(newEntryResponse)}`);
            return {
                success: true
            }
        } catch (error) {
            console.log(`Got error in [updateReadAt] for userId ${params?.userId} that is ${JSON.stringify(error?.stack)}`);
            return {
                success: false
            }
        }

    },


    fetchUserChats: async (params) => {
        try {
            console.log(`fetchUserChats util called with params ${JSON.stringify(params)}`);
            const { userId, pageNo = 1, recordsPerPage = 10, others = false, chatType = "contact" } = params;
            console.log("others", others)
            console.log("userId", userId)
            let a = JSON.parse(others || false) ? false : true
            console.log("a", a)
            const skipDocuments = (pageNo - 1) * recordsPerPage;
            const documentsLimit = recordsPerPage;
            const userChatIds = await Chats.find(
                {
                    chatType: chatType,
                    participants: new ObjectId(userId),
                    $or: [
                        { userSettings: { $size: 0 } },
                        { 'userSettings.userId': { $ne: userId } },
                        {
                            userSettings: {
                                $elemMatch: {
                                    userId: userId,
                                    isChatWithContact: true,
                                    // movedToOthers: { $ne: true },
                                    $or: [
                                        { hasUserDeletedChat: false },
                                        { hasUserDeletedChat: { $exists: false } }
                                    ]

                                }
                            }
                        }
                    ]
                }
            ).distinct('_id');

            console.log("userChatIds", userChatIds)
            let chats = await Chats.find({ _id: { $in: userChatIds } })
                .populate('participants').populate({ path: 'lastMessage', model: Messages })
                .sort({ lastMessageSentAt: -1 }).skip(skipDocuments).limit(documentsLimit);

            console.log("these are chats for users", chats)

            if (chats?.length) {
                chats = await Promise.all(chats?.map(async chat => {
                    const unreadCount = await Messages.countDocuments({
                        chat: { $in: chat?._id },
                        $or: [
                            { userSettings: { $size: 0 } },
                            { 'userSettings.userId': { $ne: userId } },
                            {
                                userSettings: {
                                    $elemMatch: {
                                        userId: userId,
                                        $or: [
                                            { readAt: null },
                                            { readAt: { $exists: false } }
                                        ]
                                    }
                                }
                            }
                        ]
                    });
                    const displayPicture = chat?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? defaultImage;
                    const messageDeliveryStatus = module.exports.msgDeliveryStatus({ userId, chat }) || {};
                    const chatDisplayInfo = {
                        chatId: chat?._id,
                        chatType: chat?.chatType,
                        chatName: chat?.groupName || chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.fullName,
                        displayPicture,
                        latestMessage: chat?.lastMessage?.content,
                        latesMessageId: chat?.lastMessage?._id,
                        latestMessageType: chat?.lastMessage?.contentType,
                        contentDescriptionType: chat?.lastMessage?.contentDescriptionType ?? 'text',
                        fileSize: chat?.lastMessage?.fileSize ?? '',
                        latestMessageSentAt: chat?.lastMessageSentAt ?? chat?.lastMessage?.createdAt,
                        latestMessageTitle: chat?.lastMessage?.title ?? '',
                        latestMessageDescription: chat?.lastMessage?.description ?? '',
                        unreadCount: unreadCount || 0,
                        ...(Object.keys(messageDeliveryStatus || {})?.length && { ...messageDeliveryStatus }),
                    }
                    return chatDisplayInfo;
                }));
            }
            const response = {
                pageNo,
                recordsPerPage,
                totalRecords: userChatIds?.length,
                chats,
            }
            return response;
        } catch (error) {
            console.log("error", error)
            console.log(`Got error in fetchUserChats for user ${params?.userId}: ${error.message}`);
            return [];
        }
    },

    fetchChatMessages: async (params) => {
        try {
            const { chatId, userId, bookingId, pageNo = 1, recordsPerPage = 20 } = params;
            const skipDocuments = (pageNo - 1) * recordsPerPage;
            const documentsLimit = recordsPerPage;
            const messagesQuery = {
                chat: chatId,
                $or: [
                    { userSettings: { $not: { $elemMatch: { userId, deletedAt: { $exists: true } } } } },
                    { userSettings: { $elemMatch: { userId, deletedAt: null } } }
                ],
            }
            if (bookingId) {
                messagesQuery.bookingId = bookingId
            }

            const totalRecords = await Messages.countDocuments(messagesQuery);
            let messages = await Messages.find(messagesQuery).populate('sender', '_id lastName firstName fullName profilePicture').sort({ createdAt: -1 }).skip(skipDocuments).limit(documentsLimit);
            const chatData = await Chats.findById(chatId);
            messages = messages?.map(message => {
                const otherUserSettings = message?.userSettings?.find(setting => setting?.userId?.toString?.() !== userId?.toString?.());
                return {
                    chatId: message?.chat,
                    messageId: message?._id,
                    sender: message?.sender,
                    content: message?.content,
                    contentType: message?.contentType,
                    contentTitle: message?.contentTitle,
                    fileSize: message?.fileSize ?? '',
                    contentDescription: message?.contentDescription ?? '',
                    contentDescriptionType: message?.contentDescriptionType ?? 'text',
                    editedAt: message?.editedAt ?? null,
                    reactionCounts: message?.reactionsCount,
                    latestMessageSentAt: message?.createdAt,
                    isRead: otherUserSettings?.readAt ? true : false,
                    isDelivered: otherUserSettings?.deliveredAt ? true : false,
                    receiverId: chatData?.participants?.find(participant => participant?.toString?.() !== message?.sender?._id?.toString?.())
                }
            });
            const messageIds = messages?.map(message => message?.messageId);
            module.exports.updateReadAt({ chatId, userId, messageIds });
            return {
                pageNo: 1,
                recordsPerPage: 20,
                totalRecords,
                messages,
            }
        } catch (error) {
            console.error("Error fetching chat messages:", error.message);
            return {
                messages: [],
                pageNo: 1,
                recordsPerPage: 20
            }
        }
    },
    fetchChatBookings: async (params) => {
        try {
            const { user, receiverId } = params;

            let customerId;
            let vendorId;
            if (user.role === "customer") {
                customerId = user?._id;
                vendorId = receiverId;
            } else {
                vendorId = user?._id;
                customerId = receiverId;
            }

     

            const query = [{
                $match: {
                    user: new mongoose.Types.ObjectId(customerId),
                }
            }, {
                $lookup: {
                    from: 'servicelistings',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'servicedetail'
                }
            }, {
                $unwind: { path: '$servicedetail', preserveNullAndEmptyArrays: true },
            }, {
                $match: {
                    'servicedetail.vendorId': new mongoose.Types.ObjectId(vendorId)
                }
            }];

            console.log("query", query);

            const result = await Bookings.aggregate(query);
            // const bookings = result[0]?.data || [];
            // console.log(result , "bookings");
            return {

                bookings:result 
            };
        } catch (error) {
            console.error("Error fetching chat bookings:", error.message);
            return {
                // pageNo,
                // recordsPerPage,
                totalRecords: 0,
                totalPages: 0,
                bookings: []
            };
        }
    },

    sendMessage: async (params) => {
        try {
            const { chatId, senderId, content, contentType } = params;
            const messageBody = {
                chat: chatId,
                sender: senderId,
                content,
                contentType,
            }
            console.log('Creating message with body:', messageBody);
            const newMessage = await Messages.create(messageBody);
            console.log('Got response of send message in [sendMessage', newMessage)
            if (newMessage) {
                console.log(`Going to update last message in chat ${chatId} with messageId ${newMessage._id}`);
                const chatUpdated = await Chats.findByIdAndUpdate(chatId, { lastMessage: newMessage._id }, { new: true });
                console.log(`Updated chat ${chatId} with last message and response is ${JSON.stringify(chatUpdated)}`);
            }
        } catch (error) {
            console.log("Error sending message:", error.message);
            return null;
        }
    },

    deleteUserChat: async (params) => {
        try {
            console.log(`deleteUserChat util called with params ${JSON.stringify(params)}`);
            const { userId, chatId } = params;
            const validateUserChat = await Chats.findOne({ _id: chatId, participants: new ObjectId(userId) });
            if (!validateUserChat) {
                console.log(`User ${userId} is not a participant of chat ${chatId}`);
                return {
                    success: false,
                    message: `User ${userId} is not a participant of chat ${chatId}`
                };
            }

            const chatUserSetting = validateUserChat?.userSettings || [];
            if (!chatUserSetting?.length) {
                chatUserSetting.push({
                    userId,
                    lastChatDeletedAt: new Date(),
                    hasUserDeletedChat: true,
                });
            } else {
                const userSpecificSettings = chatUserSetting.find(setting => setting.userId.toString() === userId.toString());
                if (userSpecificSettings) {
                    userSpecificSettings.hasUserDeletedChat = true;
                    userSpecificSettings.lastChatDeletedAt = new Date();
                } else {
                    chatUserSetting.push({
                        userId,
                        lastChatDeletedAt: new Date(),
                        hasUserDeletedChat: true,
                    });
                }
            }
            validateUserChat.markModified('userSettings');
            await validateUserChat.save();

            await Messages.updateMany(
                {
                    chat: chatId,
                    userSettings: {
                        $elemMatch: {
                            userId: userId,
                            $or: [
                                { deletedAt: { $exists: false } },
                                { deletedAt: null }
                            ]
                        }
                    }
                },
                {
                    $set: { 'userSettings.$.deletedAt': new Date() }
                }
            );

            await Messages.updateMany(
                {
                    chat: { $in: chatId },
                    'userSettings.userId': { $ne: userId }
                },
                {
                    $push: {
                        userSettings: {
                            userId: userId,
                            deletedAt: new Date(),
                        }
                    }
                }
            );




            console.log(
                `Messages updated for user ${userId} in chat ${chatId}}`
            );

            return {
                success: true,
                userId,
                chatId,
                message: `Chat and messages deleted for user ${userId}`
            };

        } catch (error) {
            console.log(`Got error in deleteUserChat for user ${params?.userId}: ${error?.stack}`);
            return {
                success: false,
                message: `Internal server error. Please try again.`,
                error: error.message
            };
        }
    },



    addReaction: async (params) => {
        try {
            console.log(`addReaction util called with params ${JSON.stringify(params)}`);
            const { messageId, userId, emoji } = params;
            const userExistingReaction = await Reactions.findOne({ objectId: messageId, user: userId });
            if (userExistingReaction) {
                userExistingReaction.emoji = emoji;
                return userExistingReaction.save();
            }
            const reactionBody = {
                objectId: messageId,
                objectOnModel: 'messages',
                user: userId,
                emoji
            }
            const reaction = await Reactions.create(reactionBody);
            console.log(`Got reaction create response in DB [add-reaction]: ${JSON.stringify(reaction)}`);
            return true;
        } catch (error) {
            console.log(`Got error in addReaction for user ${params?.userId}: ${error.message}`);
            return false;
        }
    },

    removeReaction: async (params) => {
        try {
            console.log(`removeReaction util called with params ${JSON.stringify(params)}`);
            const { messageId, userId, emoji } = params;
            return Reactions.findOneAndDelete({ objectId: messageId, user: userId, emoji });
        } catch (error) {
            console.log(`Got error in removeReaction for user ${params?.userId}: ${error.message}`);
            return false;
        }
    },


    editMessage: async (params) => {
        try {
            console.log(`editMessage util called with params ${JSON.stringify(params)}`);
            const { messageId, userId, content } = params;
            const message = await Messages.findById(messageId).populate({ path: 'chat', populate: { path: 'participants' } }).populate('sender');
            if (!message) {
                console.log(`Message with ID ${messageId} not found`);
                return {
                    success: false,
                    message: `Message with ID ${messageId} not found`
                }
            }
            if (message?.sender?._id?.toString?.() !== userId?.toString?.()) {
                console.log(`User ${userId} is not the sender of message ${messageId}`);
                return {
                    success: false,
                    message: `User ${userId} is not the sender of message ${messageId}`
                }
            }
            message.content = content;
            message.editedAt = new Date();
            await message.save();
            console.log(`Message ${messageId} edited successfully and new data is ${JSON.stringify(message)}`);
            return {
                success: true,
                data: message
            }
        } catch (error) {
            console.error(`Got error in editMessage for user ${params?.userId}: ${error.message}`);
            return {
                success: false
            };
        }
    },





    getChatGallery: async (params) => {
        try {
            console.log(`getChatGallery util called with params ${JSON.stringify(params)}`);
            const { chatId, userId, pageNo = 1, recordsPerPage = 20, contentType } = params;

            const validateUserChat = await Chats.findOne({
                _id: chatId,
                participants: new ObjectId(userId),
                $or: [

                    {
                        userSettings: {
                            $elemMatch: {
                                userId: userId,
                                $or: [
                                    { hasUserDeletedChat: false },
                                    { hasUserDeletedChat: { $exists: false } }
                                ]

                            }
                        }
                    }
                ]
            });
            if (!validateUserChat) {
                console.log(`User ${userId} is not part of chat ${chatId}`);
                return {
                    success: false,
                    message: `Chat not found for user ${userId}`
                };
            }

            const skip = (pageNo - 1) * recordsPerPage;

            let contentTypeCondition = {};

            if (contentType === "media") {
                contentTypeCondition = { contentType: { $in: ["image", "video"] } };
            } else if (contentType && contentType !== 'link') {
                contentTypeCondition = { contentType };
            }

            const contentTypeOrDescriptionCondition = {
                $or: [
                    { contentType: 'link' },
                    { contentDescriptionType: 'link' }
                ]
            };

            const query = {
                chat: chatId,
                ...(contentType === 'link' ? contentTypeOrDescriptionCondition : contentTypeCondition)
            };

            // Fetch the messages
            const messages = await Messages.find(query)
                .populate('sender')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(recordsPerPage);

            // Get the total records for pagination
            const totalRecords = await Messages.countDocuments(query);

            // Format the response
            const formattedResponse = messages?.map(message => ({
                chatId: message?.chat,
                messageId: message?._id,
                sender: {
                    _id: message?.sender?._id,
                    name: message?.sender?.name ?? 'Unknown',
                },
                content: message?.content,
                contentTitle: message?.contentTitle,
                fileSize: message?.fileSize ?? '',
                contentDescription: message?.contentDescription ?? '',
                contentType: message?.contentType,
                contentDescriptionType: message?.contentDescriptionType ?? 'text',
                isContentPaid: message?.isContentPaid,
                contentPrice: message?.contentPrice,
                contentPaymentCurrency: message?.contentPaymentCurrency,
                usersPaidForContent: [],
                isReplyIncentivized: message?.isReplyIncentivized,
                replyIncentiveAmount: message?.replyIncentiveAmount,
                replyIncentiveCurrency: message?.replyIncentiveCurrency,
                usersIncentivizedForReplying: [],
                forwardedFrom: message?.forwardedFrom,
                forwaredFromType: message?.forwaredFromType,
                replyTo: message?.replyTo,
                replyToType: message?.replyToType,
                groupMediaIdentfier: message?.groupMediaIdentfier,
                editedAt: message?.editedAt,
            }));

            console.log(
                `Got chat gallery in DB [get-chat-gallery] for ${userId} and page no ${pageNo} with length: ${formattedResponse?.length}`
            );

            return {
                success: true,
                pageNo,
                recordsPerPage,
                totalRecords,
                data: formattedResponse
            };
        } catch (error) {
            console.log(`Got error in getChatGallery for user ${params?.userId}: ${error.message}`);
            return {
                success: false,
                message: `Internal server error. Please try again.`
            };
        }
    },


    markMessageAsRead: async (params) => {
        try {
            console.log(`markMessageAsRead util called with params ${JSON.stringify(params)}`);
            let { chatId, userId } = params;
            const chat = await Chats.findOne({ _id: chatId, participants: new ObjectId(userId) });
            if (!chat) {
                console.log(`Chat with ID ${chatId} for user ${userId} not found.`);
                return {
                    success: false,
                    message: `Chat with ID ${chatId} for user ${userId} not found.`
                }
            }
            chatId = chat?._id;
            const allChatMessages = await Messages.find({ chat: chatId }).distinct('_id');
            const response = await module.exports.updateReadAt({ chatId, userId, messageIds: allChatMessages });
            if (!response) {
                console.log(`Failed to mark messages as read for chat ${chatId} and user ${userId}`);
                return {
                    success: false,
                    message: `Failed to mark messages as read for chat ${chatId} and user ${userId}`
                }
            }
            return {
                success: true,
                chatId
            }
        } catch (error) {
            console.error(`Got error in markMessageAsRead for user ${params?.userId}: ${error.message}`);
            return {
                success: false,
                message: `Internal server error. Please try again.`
            }
        }
    },


    convertMinutes: (minutes) => {
        try {
            const weeks = Math.floor(minutes / 10080); // 10080 minutes in a week
            const remainingMinutesAfterWeeks = minutes % 10080;
            const days = Math.floor(remainingMinutesAfterWeeks / 1440); // 1440 minutes in a day
            const remainingMinutesAfterDays = remainingMinutesAfterWeeks % 1440;
            const hours = Math.floor(remainingMinutesAfterDays / 60);
            const remainingMinutes = remainingMinutesAfterDays % 60;

            let result = "";
            if (weeks > 0) {
                result += `${weeks} week${weeks > 1 ? 's' : ''}`;
            }
            if (days > 0) {
                result += `${result ? ' ' : ''}${days} day${days > 1 ? 's' : ''}`;
            }
            if (hours > 0) {
                result += `${result ? ' ' : ''}${hours} hour${hours > 1 ? 's' : ''}`;
            }
            if (remainingMinutes > 0) {
                result += `${result ? ' ' : ''}${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
            }

            return result || "0 minutes";
        } catch (error) {
            console.log(`Got error in convertMinutes: ${JSON.stringify(error?.stack)}`);
            return "0 minutes";
        }
    },

    msgDeliveryStatus: (params) => {
        try {
            const { userId, chat } = params;
            console.log(`msgDeliveryStatus util called for userId and chat: ${userId} and ${chat?._id}`);
            const senderId = chat?.lastMessage?.sender?._id ? chat?.lastMessage?.sender?._id?.toString?.() : chat?.lastMessage?.sender?.toString?.();
            const showLastMsgDeliveryStatus = senderId === userId?.toString?.() ? true : false;
            const deliveryStatus = {};
            if (JSON.parse(showLastMsgDeliveryStatus || false)) {
                const isRead = chat?.lastMessage?.userSettings?.find(setting => setting?.userId?.toString?.() !== userId?.toString())?.readAt ? true : false;
                const isDelivered = isRead ? true : (chat?.lastMessage?.userSettings?.find(setting => setting?.userId?.toString?.() !== userId?.toString())?.deliveredAt ? true : false);
                deliveryStatus.isRead = isRead;
                deliveryStatus.isDelivered = isDelivered;
            }
            return deliveryStatus;
        } catch (error) {
            console.log(`Got error in msgDeliveryStatus: ${JSON.stringify(error?.stack)}`);
            return {};
        }
    },

    fetchOtherChats: async (params) => {
        try {
            console.log(`fetchOtherChats util called with params ${JSON.stringify(params)}`);
            const { userId, pageNo = 1, recordsPerPage = 10 } = params;
            const skipDocuments = (pageNo - 1) * recordsPerPage;
            const documentsLimit = recordsPerPage;
            const userChatIds = await Chats.find(
                {
                    participants: new ObjectId(userId),
                    notStarted: false,
                    userSettings: {
                        $elemMatch: {
                            userId: userId,
                            $and: [
                                {
                                    $or: [
                                        { isChatWithContact: false },
                                        // { movedToOthers: true }
                                    ],
                                },
                                {
                                    $or: [
                                        { hasUserDeletedChat: false },
                                        { hasUserDeletedChat: { $exists: false } }
                                    ]
                                }
                            ]

                        }
                    }
                }
            ).distinct('_id');
            console.log('user other chats ids', userChatIds)
            let chats = await Chats.find({ _id: { $in: userChatIds } }).sort({ updatedAt: -1 })
                .populate('participants').populate({ path: 'lastMessage', model: Messages })
                .sort({ lastMessageSentAt: -1 }).skip(skipDocuments).limit(documentsLimit);
            if (chats?.length) {
                chats = await Promise.all(chats?.map(async chat => {
                    const unreadCount = await Messages.countDocuments({
                        chat: { $in: chat?._id },
                        $or: [
                            { userSettings: { $size: 0 } },
                            { 'userSettings.userId': { $ne: userId } },
                            {
                                userSettings: {
                                    $elemMatch: {
                                        userId: userId,
                                        $or: [
                                            { readAt: null },
                                            { readAt: { $exists: false } }
                                        ]
                                    }
                                }
                            }
                        ]
                    });
                    const userSettings = chat?.userSettings?.find(setting => setting?.userId?.toString?.() == userId?.toString?.());
                    const displayPicture = chat?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.dp ?? defaultImage;
                    const chatName = chat?.groupName || chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.name
                    const receiverId = chat?.participants?.find(participant => participant?._id.toString() != userId)?._id.toString();
                    // const isBlocked = await SpamUsers.findOne({ userId, actBy: receiverId, type: 'block' }) ? true : false;
                    // const blockedByMe = await SpamUsers.findOne({ userId: receiverId, actBy: userId, type: 'block' }) ? true : false;
                    const messageDeliveryStatus = module.exports.msgDeliveryStatus({ userId, chat }) || {};
                    const chatDisplayInfo = {
                        chatId: chat?._id,
                        chatName,
                        displayPicture,
                        latestMessage: chat?.lastMessage?.content,
                        latesMessageId: chat?.lastMessage?._id,
                        latestMessageType: chat?.lastMessage?.contentType,
                        latestMessageSentAt: chat?.lastMessageSentAt ?? chat?.lastMessage?.createdAt,
                        latestMessageTitle: chat?.lastMessage?.title ?? '',
                        latestMessageDescription: chat?.lastMessage?.description ?? '',
                        isReplyIncentivized: chat?.lastMessage?.isReplyIncentivized,
                        replyIncentiveAmount: chat?.lastMessage?.replyIncentiveAmount,
                        replyIncentiveCurrency: chat?.lastMessage?.replyIncentiveCurrency,
                        hasUserIncentivizedForReplying: false,
                        isContentPaid: chat?.lastMessage?.isContentPaid,
                        contentPrice: chat?.lastMessage?.contentPrice,
                        contentPaymentCurrency: chat?.lastMessage?.contentPaymentCurrency,
                        hasUserPaidForContent: false,
                        pinnedAt: userSettings?.pinnedAt ?? null,
                        isMuted: userSettings?.hasUserMutedChat ?? false,
                        unreadCount: unreadCount || 0,
                        receiverId,
                        isBlocked,
                        blockedByMe,
                        ...(Object.keys(messageDeliveryStatus || {})?.length && { ...messageDeliveryStatus }),
                        isOthersRequestPending: JSON.parse(userSettings?.isOthersRequestPending || false) ? true : false,
                    }
                    return chatDisplayInfo;
                }));
            }
            const response = {
                pageNo,
                recordsPerPage,
                totalRecords: userChatIds?.length,
                chats,
            }
            return response;
        } catch (error) {
            console.log(`Got error in fetchUserChats for user ${params?.userId}: ${error?.stack}`);
            return [];
        }
    },

    acceptOtherRequest: async (params) => {
        try {
            console.log(`acceptOtherRequest util called with params ${JSON.stringify(params)}`);
            const { userId, chatId } = params;
            if (!chatId) {
                console.log(`ChatId is required to accept other request.`);
                return {
                    success: false,
                    message: `ChatId is required to accept other request.`
                }
            }
            const validateChat = await Chats.findOne({ _id: chatId, participants: userId });
            if (!validateChat) {
                console.log(`User ${userId} is not part of chat ${chatId}`);
                return {
                    success: false,
                    message: `User ${userId} is not part of chat ${chatId}`
                }
            }
            if (!validateChat?.userSettings?.length) {
                const userSpecificSettings = [{
                    userId,
                    isChatWithContact: true
                }];
                validateChat.userSettings = userSpecificSettings;
            } else {
                const userSettings = validateChat?.userSettings?.find(setting => setting?.userId?.toString?.() === userId?.toString?.());
                if (!userSettings) {
                    console.log(`User settings not found for user ${userId} in chat ${chatId}`);
                    validateChat.userSettings.push({
                        userId,
                        isChatWithContact: true,
                        isRequestAccepted: true

                    });
                } else {
                    userSettings.isChatWithContact = true;
                    userSettings.isOthersRequestPending = false;
                    userSettings.isRequestAccepted = true;
                }
            }
            validateChat.markModified('userSettings');
            await validateChat.save();
            const contactId = validateChat?.participants?.find?.(participant => participant?.toString?.() !== userId?.toString?.());
            const contactResponse = await module.exports.addSenderToContact({ userId, contactId });
            if (!contactResponse?.success) {
                console.log(`Failed to add sender to contact for user ${userId} and contact ${contactId}`);
                return {
                    success: false,
                    message: `Failed to add sender to contact for user ${userId} and contact ${contactId}`
                }
            }
            return {
                success: true,
                data: contactResponse?.data
            }
        } catch (error) {
            console.log(`Got error in acceptOtherRequest for user ${params?.userId}: ${error?.stack}`);
            return {
                success: false
            }
        }
    },

    sendPushNotification: async (params) => {
        try {
            const { sender = null, receiver = null, latestMessageData, chatId, notificationBody, deviceId } = params;
            console.log(`sendPushNotification util called with params ${JSON.stringify(params)}`);
            // Helper function to validate FCM token (basic check)
            if (!latestMessageData || !sender || !receiver || !chatId) {
                console.log("invalid message data");
                return
            }
            const validateFcmToken = (token) => {
                return typeof token === 'string' && token.trim() !== '';
            };
            // Create a descriptive body based on the content type

            // Validate the FCM tokens for sender and receiver and skip notification if invalid
            // if (!validateFcmToken(sender?.fcmToken)) {
            //     console.error("Invalid or empty FCM token for sender. No notification will be sent.");
            // } else {
            //     const notificationForSender = {
            //         notification: {
            //             title: sender.name, 
            //             body: latestMessageData?.content 
            //         },
            //         data: {
            //             userId: sender._id?.toString(),
            //             chatId: chatId?.toString()
            //         },
            //         tokens: [sender?.fcmToken]
            //     };

            //     console.log("Notification for Sender:", notificationForSender);

            //     // Sending notification to the sender
            //     const senderResponse = await getMessaging().sendEachForMulticast(notificationForSender);
            //     console.log("Sender Notification response:", JSON.stringify(senderResponse));
            // }

            // const fcmToken = receiver?.deviceTokens.get(deviceId) ?? receiver?.fcmToken

            if (!validateFcmToken(receiver?.fcmToken)) {
                console.error("Invalid or empty FCM token for receiver. No notification will be sent.");
            } else {
                const notificationForReceiver = {
                    notification: {
                        title: sender.name,
                        body: notificationBody || latestMessageData?.content
                    },
                    data: {
                        userId: sender._id?.toString(),
                        chatId: chatId?.toString()
                    },
                    tokens: [receiver?.fcmToken]
                };

                console.log("Notification for Receiver:", notificationForReceiver);

                // // Sending notification to the receiver
                // const receiverResponse = await getMessaging().sendEachForMulticast(notificationForReceiver);
                // console.log("Receiver Notification response:", JSON.stringify(receiverResponse) );
            }

            console.log("Notifications sent successfully if tokens were valid.");

        } catch (error) {
            console.error("Error sending notification:", error);
            // Optionally, handle more specific FCM errors (e.g., invalid token errors)
            if (error.message.includes('invalid')) {
                console.error("FCM token error:", error.message);
            }
        }
    },

    calculateUnreadCounts: async (userId) => {
        try {
            // Fetch unread chats
            const userChatIds = await Chats.find({
                participants: new ObjectId(userId),
                $or: [
                    { userSettings: { $size: 0 } },
                    { 'userSettings.userId': { $ne: userId } },
                    {
                        userSettings: {
                            $elemMatch: {
                                userId: userId,
                                $or: [
                                    { readAt: null },
                                    { readAt: { $exists: false } }
                                ]
                            }
                        }
                    }
                ]
            }).distinct('_id');

            // Count unread messages in these chats
            const unreadMessages = await Messages.countDocuments({
                chat: { $in: userChatIds },
                $or: [
                    { userSettings: { $size: 0 } },
                    { 'userSettings.userId': { $ne: userId } },
                    {
                        userSettings: {
                            $elemMatch: {
                                userId: userId,
                                $or: [
                                    { readAt: null },
                                    { readAt: { $exists: false } }
                                ]
                            }
                        }
                    }
                ]
            });

            return {
                unreadChats: userChatIds.length,
                unreadMessages,
            };
        } catch (error) {
            console.error("Error calculating unread counts:", error);
            return { unreadChats: 0, unreadMessages: 0 };
        }
    },


    getNotificationBody: (message) => {
        const contentType = message?.contentType;
        switch (contentType) {
            case 'image':
                return "Image shared";
            case 'video':
                return "Video shared";
            case 'audio':
                return "Audio shared";
            case 'file':
                return "File shared";
            case 'contact':
                return `Contact shared: ${message?.sharedContact?.name || "Unknown"}`;
            case 'current_location':
                return "Location shared";
            case 'live_location':
                return "Live location shared";
            case 'link':
                return `Link shared`;
            // return `Link shared: ${message?.contentTitle || "No Title"}`;
            case 'text':
            default:
                return message?.content || "New message";
        }
    },

    fetchUnseenChatCounts: async (userId) => {
        try {
            const userChatIds = await Chats.find(
                {
                    participants: new ObjectId(userId),
                    notStarted: false,
                    $or: [
                        { userSettings: { $size: 0 } },
                        { 'userSettings.userId': { $ne: userId } },
                        {
                            userSettings: {
                                $elemMatch: {
                                    userId: userId,
                                    $and: [
                                        {
                                            $or: [
                                                { isDeletedFrom2Reply: false },
                                                { isDeletedFrom2Reply: { $exists: false } }
                                            ],
                                        },
                                        {
                                            $or: [
                                                { hasUserDeletedChat: false },
                                                { hasUserDeletedChat: { $exists: false } }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            ).distinct('_id');
            const unseenChats = await Messages.find({
                chat: { $in: userChatIds },
                $or: [
                    { userSettings: { $exists: false } },
                    { userSettings: { $size: 0 } },
                    {
                        userSettings: {
                            $not: {
                                $elemMatch: {
                                    userId: userId
                                }
                            }
                        }
                    },
                    {
                        userSettings: {
                            $elemMatch: {
                                userId: { $eq: userId },
                                $or: [
                                    { readAt: { $exists: false } },
                                    { readAt: null }
                                ]
                            }
                        }
                    },
                ]
            }).distinct('chat');
            console.log('unseen chat ids'.green.bold, unseenChats);
            const allUnseenChats = await Chats.countDocuments({ _id: { $in: unseenChats } });


            return {
                unseenChatsCount: allUnseenChats,
            };
        } catch (error) {
            console.error("Error fetching unseen chat counts:", error.message);
            return {
                unseenChatsCount1: 0,
                message: "No unseen chats",
            };
        }
    }




}


