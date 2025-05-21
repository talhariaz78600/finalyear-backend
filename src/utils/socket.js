const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { ObjectId } = require("mongoose").Types

const moment = require('moment')
const UsersModel = require('../models/users/User');
const MessagesModel = require('../models/chat/Message');
const ChatsModel = require('../models/chat/Chat');
const ReactionsModel = require('../models/chat/Reaction');

const Messages = require('../models/chat/Message');
const {
    authMiddleWareSocket,
    updateDeliveredAt,
    fetchUnseenChats,
    fetchUserChats,
    msgDeliveryStatus,
    updateReadAt,
    deleteUserChat,
    addReaction,
    fetchChatMessages,
    fetchChatBookings,
    removeReaction,
    editMessage,
    markMessageAsRead,
    getUserNotifications,
    getUserUnreadNotifications,
    readUserNotifications


} = require('./socket-utils');
const Bookings = require('../models/Bookings');
const sendNotification = require('./storeNotification');


let io;

const defaultImage = 'https://randomuser.me/api/portraits/men/14.jpg'

function initializeSocket(server) {
    if (!io) {
        console.log("Socket.io is not initialized.");
        io = new Server(server, { cors: { origin: "*" } });
    }
    io.use(authMiddleWareSocket);


    // io.adapter(redisAdapter({ host: REDIS_HOST, port: REDIS_PORT }));

    io.on('connection', async (socket) => {
        const socketId = socket.id;
        const userId = socket?.user?._id.toString();
        const username = socket?.user?.fullName ?? socket?.user?.firstName;
        const user = socket?.user
        const subAdmin = socket?.subAdmin?.toObject()

        console.log(subAdmin?.role, subAdmin?.adminRole, "this is sub admin data")

        if (userId) {
            socket.join(userId.toString())
            console.log(`User ${userId}  ${username} connected and joined room `);
        }

        if (subAdmin?.adminRole === "subAdmin") {

            socket.join(`notification_subAdmin_${subAdmin?._id}`)

        } else if (subAdmin?.adminRole === "admin") {
            console.log(subAdmin?.adminRole, "this is sub admin data")
            socket.join(`notification_admin`)
        }
        try {


            const userChatIds = await ChatsModel.find(
                {
                    participants: new ObjectId(userId),
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
            const undeliveredMessagesQuery = {
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
                                    { deliveredAt: { $exists: false } },
                                    { deliveredAt: null }
                                ]
                            }
                        }
                    }
                ],
            }
            const undeliveredChatIds = await MessagesModel.find(undeliveredMessagesQuery).distinct('chat');

            if (undeliveredChatIds?.length) {
                const undeliverdChats = await ChatsModel.find({ _id: { $in: undeliveredChatIds } });
                undeliverdChats?.map(async (chat) => {
                    const otherUserId = chat?.participants?.find(participant => participant.toString() !== userId.toString());
                    const otherUserSocketId = io.sockets.adapter.rooms.get(otherUserId?.toString?.());
                    if (otherUserSocketId) {
                        io.to(otherUserId?.toString?.()).emit('mark-message-deliver-response', { success: true, chatId: chat?._id, allMsgsDelivered: true });
                    }
                });
                undeliverdChats?.map(async (chat) => {
                    await updateDeliveredAt({
                        userId,
                        chatIds: [chat?._id],
                    });
                });

            }
        } catch (error) {
            console.log("socket connection error")
            socket.emit('socket-error', { message: 'Error in updating chats.' });
            console.log("error", error)
        }
        socket.on(
            "disconnect",
            () => {
                console.log(`User ${userId} disconnected.`);
            }
        );


        socket.on('get-user-active-status', async (data) => {
            try {
                console.log(`user-active-status event received for socket ${socketId} and called by user ${userId} with data: ${JSON.stringify(data)}`);
                const { userToCheckId } = data;
                const isUserOnline = io.sockets.adapter.rooms.get(userToCheckData?.toString?.()) ? true : false;
                if (isUserOnline) {
                    socket.emit('user-active-status', { isUserOnline: true });
                    return;
                }
                const userToCheckData = await UsersModel.findById(userToCheckId);
                const lastSeen = userToCheckData?.lastSeen;
                socket.emit('user-active-status', { isUserOnline: false, lastSeen });
                return;
            } catch (error) {
                console.log(`Got error in get-user-active-status: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in getting user active status.' });
            }
        });

        socket.on('fetch-unseen-chats', async (data) => {
            try {
                const unseenChats = await fetchUnseenChats({ ...data, userId });
                console.log(`Found unseen chats in [fetch-unseen-chats] for user ${userId}`);
                socket.emit('unseen-chats', unseenChats);
            } catch (error) {
                console.log(`Got error in fetch-unseen-chats: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching unseen chats.' });
            }
        });


        /////////////////////// fetch-user-chats done ///////////////////////// 
        socket.on('fetch-user-chats', async (data) => {
            try {
                console.log(`fetch-chats event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const chats = await fetchUserChats({ ...data, userId });
                console.log(`Found  user chats in [fetch-user-chats] for user ${userId}`);
                socket.emit('user-chats', chats);
            } catch (error) {
                console.log(`Got error in fetch-user-chats: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching unseen chats.' });
            }
        });

        socket.on('fetch-chat-booking', async (data) => {
            try {

                let receiverId = data?.receiverId;
                if (receiverId && typeof receiverId === 'object' && receiverId._id) {
                    receiverId = receiverId._id.toString();
                }
                if (!receiverId && !data?.chatId) {
                    console.log(`Receiver id or chat id is required in send-message`);
                    socket.emit('socket-error', { message: 'Receiver id or chat id is required.' });
                    return;
                }
                if (data?.chatId) {
                    const validateUserChat = await ChatsModel.findOne({ _id: data?.chatId, participants: new ObjectId(userId) });
                    console.log(`Got chat validation response in DB [send-message]: ${JSON.stringify(validateUserChat)}`);
                    if (!validateUserChat) {
                        // console.log(`No chat found against chat id ${data?.chatId} and user ${userId} in send-message`);
                        socket.emit('socket-error', { message: 'No chat found against chat id and user.' });
                        return;
                    }
                    if (receiverId && !validateUserChat?.participants?.includes(receiverId)) {
                        // console.log(`Receiver is not a part of chat ${data?.chatId} in send-message`);
                        socket.emit('socket-error', { message: `You can't send message to user who is not part of chat.` });
                        return;
                    } else {
                        receiverId = validateUserChat?.participants?.find(participant => participant.toString?.() !== userId?.toString());
                    }
                }
                console.log(`fetch-chats event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const bookings = await fetchChatBookings({ ...data, receiverId, user: socket?.user });
                console.log(`Found  user chats in [fetch-chat-booking] for user ${userId}`);
                socket.emit('user-booking', bookings);
            } catch (error) {
                console.log(`Got error in fetch-chat-bookings: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching chat booking' });
            }
        });

        socket.on('fetch-user-chat-messages', async (data) => {
            try {
                console.log(`fetch-user-chat-messages event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const { chatId } = data;
                if (!chatId) {
                    console.log(`Chat id is required in fetch-user-chat-messages`);
                    socket.emit('socket-error', { message: 'Chat id is required.' });
                    return;
                }
                const response = await fetchChatMessages({ ...data, userId });
                socket.emit('user-chat-messages', response);
                const chatDetails = await ChatsModel.findById(chatId);
                if (chatDetails) {
                    const otherParticipant = chatDetails?.participants?.find(participant => participant.toString() !== userId.toString());
                    const otherParticipantId = otherParticipant?._id?.toString?.();
                    const otherParticipantSocketId = io.sockets.adapter.rooms.get(otherParticipantId);
                    if (otherParticipantSocketId) {
                        io.to(otherParticipantId).emit('mark-message-read-response', { success: true, chatId, allMsgsRead: true });
                    }
                }
            } catch (error) {
                console.log(`Got error in fetch-user-chat-messages: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching unseen chats.' });
            }
        });


        socket.on('check-user-existingchat', async (data) => {
            try {
                console.log(`check-user-existingchat event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                let receiverId = data?.receiverId;

                if (receiverId && typeof receiverId === 'object' && receiverId._id) {
                    receiverId = receiverId._id.toString();
                }

                // if ( userId.toString() === receiverId.toString() ){
                //     socket.emit('socket-error', { message: 'Receiver id is current UserId!' });
                //     return;
                // }

                let chatId = null;
                const checkExistingChat = await ChatsModel.findOne({ participants: [userId, receiverId] });
                if (checkExistingChat) {
                    chatId = checkExistingChat?._id.toString();
                }
                console.log(`checking for exisitng chat response in DB [check-user-existingchat]: ${chatId} ${JSON.stringify(checkExistingChat)}`);
                socket.emit('user-existingChatId', { chatId });
            } catch (error) {
                console.log(`Got error in check-user-existingchat: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching unseen chats.' });
            }

        });

        //////////////////////////////////// send-message done /////////////////////////
        socket.on('send-message', async (data) => {
            try {

                let receiverId = data?.receiverId;
                const senderData = user ////////////////////// this is required for process /////////////////////////


                if (!data?.chatType) {
                    socket.emit('socket-error', { message: 'chatType is required.' });
                    return;
                }
                let bookingId = data?.bookingId;
                if (data?.chatType === 'service') {
                    if (!bookingId) {
                        socket.emit('socket-error', { message: 'Booking id is required.' });
                        return
                    }
                }
                if (bookingId) {
                    const findBooking = await Bookings.findById(bookingId);
                    if (!findBooking) {
                        socket.emit('socket-error', { message: `Booking not found with id ${bookingId._id}` });
                        return
                    }
                    bookingId = findBooking._id.toString();
                }

                if (receiverId && typeof receiverId === 'object' && receiverId._id) {
                    receiverId = receiverId._id.toString();
                }
                if (!receiverId && !data?.chatId && data?.chatType !== 'contact') {
                    socket.emit('socket-error', { message: 'Receiver id or chat id is required.' });
                    return;
                }

                if (data?.chatId) {
                    const validateUserChat = await ChatsModel.findOne({ _id: data?.chatId, participants: new ObjectId(userId) });
                    console.log(`Got chat validation response in DB [send-message]: ${JSON.stringify(validateUserChat)}`);
                    if (!validateUserChat) {
                        socket.emit('socket-error', { message: 'No chat found against chat id and user.' });
                        return;
                    }
                    if (receiverId && !validateUserChat?.participants?.includes(receiverId)) {
                        socket.emit('socket-error', { message: `You can't send message to user who is not part of chat.` });
                        return;
                    } else {
                        receiverId = validateUserChat?.participants?.find(participant => participant.toString?.() !== userId?.toString());
                        console.log(`Receiver id is ${receiverId}`, "this is receiver id ..........................................................");
                    }
                }
                let receiverData;
                if (!receiverId && data?.chatType !== "contact") {
                    socket.emit('socket-error', { message: `Failed to retreive receiver data.` });
                    return;
                }

                console.log(`Receiver id is ${receiverId}`, "this is receiver id ..........................................................");

                if (data?.chatType === "contact" && !receiverId) {
                    receiverData = await UsersModel.findOne({ adminRole: "admin" });
                    receiverId = receiverData?._id.toString();
                } else {
                    receiverData = await UsersModel.findById(receiverId.toString());
                }

                if (!receiverData) {
                    socket.emit('socket-error', { message: `Invalid receiver data.` });
                    return;
                }

                let chatId = data?.chatId;

                if (!chatId) {
                    let chat;

                    // Case when chatting with oneself
                    if (userId.toString?.() === receiverId.toString?.()) {

                        socket.emit('with-me', { message: 'chat with me' });

                        return
                    } else {
                        chat = await ChatsModel.findOne({
                            chatType: data?.chatType,
                            participants: { $all: [userId, receiverId], $size: 2 }
                        });

                    }

                    if (!chat) {
                        console.log("No existing chat found. Creating a new one...");

                        chat = await ChatsModel.create({ participants: [userId, receiverId], chatType: data?.chatType });
                     sendNotification({
                            userId: receiverId,
                            title: 'New Message',
                            message: `${senderData?.fullName} has sent you a message.`,
                            type: 'message',
                            fortype: "customer_support",
                            permission: 'help'
                        });
                    }

                    console.log("Chat found or created:", chat);
                    chatId = chat._id;
                }


                const chatDetailsQuery = {
                    ...(chatId ? { _id: chatId } : { participants: { $all: [userId, receiverId] } }),
                }
                const chatDetails = await ChatsModel.findOne(chatDetailsQuery).populate('participants');
                if (!chatDetails) {
                    console.log(`No chat found against chat id ${chatId} and participants ${userId} and ${receiverId} in send-message`);
                    socket.emit('socket-error', { message: 'No chat found against chat id and participants.' });
                    return;
                }



                chatDetails.markModified('userSettings');
                await chatDetails.save();
                const chatName = (userId.toString() === receiverId.toString() ? `${chatDetails?.participants?.find(participant => participant?._id?.toString() === userId.toString())?.fullName} (You)` : chatDetails?.participants?.find(participant => participant?._id?.toString() !== userId.toString())?.fullName)

                const receiverSocketId = io.sockets.adapter.rooms.get(receiverId?.toString?.());
                const userSettingsBody = [
                    {
                        userId,
                        deliveredAt: new Date(),
                        readAt: new Date()
                    },

                ];
                if (receiverSocketId) {
                    userSettingsBody.push({
                        userId: receiverId,
                        deliveredAt: new Date(),
                    });
                }

                const messageBody = {
                    chat: chatId,
                    sender: userId,
                    contentTitle: data?.contentTitle,
                    fileSize: data?.fileSize,
                    content: data?.content,
                    contentDescription: data?.contentDescription,
                    contentType: data?.contentType,
                    contentDescriptionType: data?.contentDescriptionType,
                    userSettings: userSettingsBody,
                    bookingId: bookingId
                }
                const addMessage = await MessagesModel.create(messageBody);

                const latestMessageData = addMessage

                const unreadCount = await Messages.countDocuments({
                    chat: { $in: chatId },
                    $or: [
                        { userSettings: { $size: 0 } },
                        { 'userSettings.userId': { $ne: receiverId } },
                        {
                            userSettings: {
                                $elemMatch: {
                                    userId: receiverId,
                                    $or: [{ readAt: null }, { readAt: { $exists: false } }]
                                }
                            }
                        }
                    ]
                });
                console.log("unreadCount", unreadCount);

                const messageEmitBody = {
                    chatScreenBody: {
                        chatId,
                        chatName,
                        chatType: chatDetails?.chatType,
                        receiverId,
                        latestMessage: addMessage?.content ?? '',
                        latesMessageId: addMessage?._id,
                        latestMessageType: addMessage?.contentType ?? 'text',
                        contentDescriptionType: addMessage?.contentDescriptionType ?? 'text',
                        latestMessageSentAt: addMessage?.createdAt,
                        latestMessageTitle: addMessage?.contentTitle ?? '',
                        fileSize: addMessage?.fileSize ?? '',
                        latestMessageDescription: addMessage?.contentDescription ?? '',
                        unreadCount: unreadCount,

                    },
                    messageScreenBody: {
                        chatId,
                        messageId: addMessage?._id,
                        sender: {
                            _id: userId,
                            name: senderData?.fullName,
                            profilePicture: senderData?.profilePicture ?? defaultImage,
                        },
                        content: addMessage?.content,
                        latestMessageSentAt: addMessage?.createdAt,
                        contentTitle: addMessage?.contentTitle,
                        fileSize: addMessage?.fileSize ?? '',
                        contentDescription: addMessage?.contentDescription,
                        contentType: addMessage?.contentType,
                        contentDescriptionType: addMessage?.contentDescriptionType ?? 'text',


                    }
                }

                const chatNameForUser = (chatDetails, userId) => {
                    return chatDetails?.groupName ||
                        chatDetails?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.fullName;
                };

                const chatProfileForUser = (chatDetails, userId) => {
                    return chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId.toString?.())?.profilePicture ?? chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? defaultImage;
                };

                const messageDeliveryStatus = msgDeliveryStatus({ userId, chat: { lastMessage: latestMessageData } }) || {};
                io.to(userId.toString()).emit('receive-message', {
                    ...messageEmitBody,
                    chatScreenBody: {
                        ...messageEmitBody.chatScreenBody,
                        unreadCount: 0,
                        chatName: chatNameForUser(chatDetails, userId), // Set chatName for the sender
                        displayPicture: chatProfileForUser(chatDetails, userId), // Set displayPicture for the sender,
                        ...(Object.keys(messageDeliveryStatus || {})?.length && {
                            ...messageDeliveryStatus
                        })

                    }
                });

                if (receiverId.toString() !== userId.toString()) {
                    if (receiverSocketId) {
                        io.to(receiverId.toString()).emit('receive-message', {
                            ...messageEmitBody,
                            chatScreenBody: {
                                ...messageEmitBody.chatScreenBody,
                                chatName: chatNameForUser(chatDetails, receiverId),
                                displayPicture: chatProfileForUser(chatDetails, receiverId),
                            },
                        });
                        io.to(userId?.toString?.()).emit('mark-message-deliver-response', { success: true, chatId, allMsgsDelivered: true });
                    }
                }

                const updateChatBody = {
                    lastMessage: addMessage?._id,
                    lastMessageSentAt: new Date(),
                    'userSettings.$[elem].hasUserDeletedChat': false
                };
                const objectChatId = new mongoose.Types.ObjectId(chatId);
                const objectUserId = new mongoose.Types.ObjectId(userId);
                await ChatsModel.updateOne(
                    { _id: objectChatId },
                    { $set: updateChatBody },
                    {
                        arrayFilters: [
                            { 'elem.userId': objectUserId }
                        ]
                    }
                );


                const allChatMessages = await MessagesModel.find({ chat: chatId }).distinct('_id');
                await updateReadAt({
                    userId,
                    chatId,
                    messageIds: allChatMessages
                });

                chatDetails.markModified('userSettings');

            } catch (error) {
                console.log(error)

                socket.emit('socket-error', { message: 'Failed to send message' });
                return;
            }
        });





        ////////////////////////////////get single chat for user /////////////////////////
        socket.on('get-user-single-chat', async (data) => {
            try {

                let receiverId = data?.receiverId;

                if (!data?.chatType) {
                    socket.emit('socket-error', { message: 'chatType is required.' });
                    return;
                }




                if (receiverId && typeof receiverId === 'object' && receiverId._id) {
                    receiverId = receiverId._id.toString();
                }
                if (!receiverId && data?.chatType !== 'contact') {
                    socket.emit('socket-error', { message: 'Receiver id or chat id is required.' });
                    return;
                }


                let receiverData;
                if (!receiverId && data?.chatType !== "contact") {
                    socket.emit('socket-error', { message: `Failed to retreive receiver data.` });
                    return;
                }


                if (data?.chatType === "contact" && !receiverId) {
                    receiverData = await UsersModel.findOne({ adminRole: "admin" });
                    receiverId = receiverData?._id.toString();
                } else {
                    receiverData = await UsersModel.findById(receiverId.toString());
                }

                if (!receiverData) {
                    socket.emit('socket-error', { message: `Invalid receiver data.` });
                    return;
                }

                let chatId = data?.chatId;

                if (!chatId) {
                    let chat;

                    // Case when chatting with oneself
                    if (userId.toString?.() === receiverId.toString?.()) {

                        socket.emit('with-me', { message: 'chat with me' });

                        return
                    } else {
                        chat = await ChatsModel.findOne({
                            chatType: data?.chatType,
                            participants: { $all: [userId, receiverId], $size: 2 }
                        });
                    }

                    if (!chat) {
                        console.log("No existing chat found. Creating a new one...");

                        chat = await ChatsModel.create({ participants: [userId, receiverId], chatType: data?.chatType });
                    }

                    console.log("Chat found or created:", chat);
                    chatId = chat._id;
                }


                const chatDetailsQuery = {
                    ...(chatId ? { _id: chatId } : { participants: { $all: [userId, receiverId] } }),
                }
                const chatDetails = await ChatsModel.findOne(chatDetailsQuery).populate('participants');
                if (!chatDetails) {
                    console.log(`No chat found against chat id ${chatId} and participants ${userId} and ${receiverId} in send-message`);
                    socket.emit('socket-error', { message: 'No chat found against chat id and participants.' });
                    return;
                }



                chatDetails.markModified('userSettings');
                await chatDetails.save();
                const chatName = (userId.toString() === receiverId.toString() ? `${chatDetails?.participants?.find(participant => participant?._id?.toString() === userId.toString())?.fullName} (You)` : chatDetails?.participants?.find(participant => participant?._id?.toString() !== userId.toString())?.fullName)

                const receiverSocketId = io.sockets.adapter.rooms.get(receiverId?.toString?.());
                const userSettingsBody = [
                    {
                        userId,
                        deliveredAt: new Date(),
                        readAt: new Date()
                    },

                ];
                if (receiverSocketId) {
                    userSettingsBody.push({
                        userId: receiverId,
                        deliveredAt: new Date(),
                    });
                }

                const latestMessageData = await Messages.findOne({ chat: chatId });



                const unreadCount = await Messages.countDocuments({
                    chat: { $in: chatId },
                    $or: [
                        { userSettings: { $size: 0 } },
                        { 'userSettings.userId': { $ne: receiverId } },
                        {
                            userSettings: {
                                $elemMatch: {
                                    userId: receiverId,
                                    $or: [{ readAt: null }, { readAt: { $exists: false } }]
                                }
                            }
                        }
                    ]
                });
                console.log("unreadCount", unreadCount);

                const messageEmitBody = {
                    chatScreenBody: {
                        chatId,
                        chatName,
                        chatType: chatDetails?.chatType,
                        receiverId,
                        latestMessage: latestMessageData?.content ?? '',
                        latesMessageId: latestMessageData?._id,
                        latestMessageType: latestMessageData?.contentType ?? 'text',
                        contentDescriptionType: latestMessageData?.contentDescriptionType ?? 'text',
                        latestMessageSentAt: latestMessageData?.createdAt,
                        latestMessageTitle: latestMessageData?.contentTitle ?? '',
                        fileSize: latestMessageData?.fileSize ?? '',
                        latestMessageDescription: latestMessageData?.contentDescription ?? '',
                        unreadCount: unreadCount,

                    }
                }

                const chatNameForUser = (chatDetails, userId) => {
                    return chatDetails?.groupName ||
                        chatDetails?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.fullName;
                };

                const chatProfileForUser = (chatDetails, userId) => {
                    return chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId.toString?.())?.profilePicture ?? chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? defaultImage;
                };

                const messageDeliveryStatus = msgDeliveryStatus({ userId, chat: { lastMessage: latestMessageData } }) || {};
                io.to(userId.toString()).emit('get-single-chat', {
                    ...messageEmitBody,
                    chatScreenBody: {
                        ...messageEmitBody.chatScreenBody,
                        unreadCount: 0,
                        chatName: chatNameForUser(chatDetails, userId), // Set chatName for the sender
                        displayPicture: chatProfileForUser(chatDetails, userId), // Set displayPicture for the sender,
                        ...(Object.keys(messageDeliveryStatus || {})?.length && {
                            ...messageDeliveryStatus
                        })

                    }
                });


            } catch (error) {
                console.log(error)

                socket.emit('socket-error', { message: 'Failed to send message' });
                return;
            }
        });


        socket.on('delete-chat', async (data) => {
            try {
                console.log(`delete-chat event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const chatDeleted = await deleteUserChat({ ...data, userId });
                if (!chatDeleted?.success) {
                    socket.emit('socket-error', { message: chatDeleted?.message ?? 'Failed to delete chat' });
                    return
                }
                socket.emit('chat-deleted', {
                    ...chatDeleted
                });
            } catch (error) {
                console.log(`Got error in delete-chat: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in deleting chat.' });
            }
        });


        socket.on('add-reaction', async (data) => {
            try {
                console.log(`add-reaction event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const { emoji, messageId } = data;
                if (!emoji || !messageId) {
                    console.log(`Emoji and message id are required in add-reaction`);
                    socket.emit('socket-error', { message: 'Emoji and message id are required.' });
                    return;
                }

                console.log(emoji, messageId);

                const message = await MessagesModel.findById(messageId).populate({ path: 'chat', populate: { path: 'participants' } });

                console.log(message, "message")

                if (!message?.chat?.participants?.some(participant => participant?._id?.toString() === userId?.toString())) {
                    socket.emit('socket-error', { message: 'User is not a part of chat.' });
                    return;
                }


                const userExistingReaction = await ReactionsModel.findOne({ objectId: messageId, user: userId })
                if (userExistingReaction) {
                    const existingEmoji = userExistingReaction.emoji;

                    if (existingEmoji && message?.reactionsCount?.get?.(existingEmoji) > 0) {
                        const newCount = message.reactionsCount.get(existingEmoji) - 1;
                        if (newCount > 0) {
                            message.reactionsCount.set(existingEmoji, newCount);
                        } else {
                            message.reactionsCount.delete(existingEmoji);
                        }
                    }

                    userExistingReaction.emoji = emoji;
                    await userExistingReaction.save();
                } else {
                    const reactionBody = {
                        objectId: messageId,
                        objectOnModel: 'messages',
                        user: userId,
                        emoji
                    };
                    await ReactionsModel.create(reactionBody);
                }

                message.reactionsCount.set(emoji, (message.reactionsCount.get(emoji) || 0) + 1);
                const receiverId = message?.chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?._id.toString()
                message.markModified('reactionsCount');
                await message.save();

                const reactionsList = await ReactionsModel.find({ objectId: messageId })
                    .populate('user', '_id name Username dp');

                const detailedReactions = reactionsList.map(reaction => ({
                    userId: reaction.user._id,
                    userName: reaction.user.name,
                    profilePicture: reaction.user.profilePicture,
                    emoji: reaction.emoji
                }));


                const payload = {
                    chatId: message?.chat?._id,
                    messageId,
                    emoji,
                    reactionsCount: message?.reactionsCount,
                    sId: message?.sId ?? '',
                    userId,
                    reactions: detailedReactions
                };

                io.to(userId.toString()).emit('reaction', payload);
                io.to(receiverId).emit('reaction', payload);

                await addReaction({ ...data, userId });
            } catch (error) {
                console.log(`Got error in add-reaction: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in forwarding message.' });
            }

        });

        socket.on('remove-reaction', async (data) => {
            try {
                console.log(`remove-reaction event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const { emoji, messageId } = data;

                const message = await MessagesModel.findById(messageId).populate({ path: 'chat', populate: { path: 'participants' } });
                if (!message) {
                    socket.emit('socket-error', { message: 'Message not found.' });
                    return;
                }

                const userReaction = await ReactionsModel.findOne({ objectId: messageId, user: userId, emoji });
                if (!userReaction) {
                    socket.emit('socket-error', { message: 'No reaction from the user found for the message or emoji.' });
                    return;
                }

                if (message?.reactionsCount?.has?.(emoji)) {
                    const newCount = message?.reactionsCount?.get?.(emoji) - 1;
                    if (newCount > 0) {
                        message.reactionsCount.set(emoji, newCount);
                    } else {
                        message.reactionsCount.delete(emoji);
                    }
                }
                const receiverId = message?.chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?._id.toString()

                message.markModified('reactionsCount');
                await message.save();

                io.to(userId.toString()).emit('remove-reaction-response', {
                    chatId: message?.chat?._id,
                    messageId,
                    emoji,
                    reactionsCount: message.reactionsCount.get(emoji) || {},
                    sId: message?.sId ?? ''

                });
                io.to(receiverId).emit('remove-reaction-response', {
                    chatId: message?.chat?._id,
                    messageId,
                    emoji,
                    reactionsCount: message.reactionsCount.get(emoji) || {},
                    sId: message?.sId ?? ''

                });
                await removeReaction({ ...data, userId });
            } catch (error) {
                console.log(`Got error in remove-reaction: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in removing reaction.' });
            }
        });


        socket.on('edit-message', async (data) => {
            try {
                console.log(`edit-message event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const response = await editMessage({ ...data, userId });
                if (!response?.success) {
                    console.log(`Got error in edit-message: ${response?.message}`);
                    socket.emit('socket-error', { message: response?.message });
                    return;
                }
                const message = response?.data ?? {};
                console.log('message', message)
                const { chat = {} } = message;
                console.log('chat', chat)
                const unreadCount = await MessagesModel.countDocuments({
                    chat: { $in: chat?._id },
                    $or: [
                        { [`userSettings.${userId}`]: { $exists: false } },
                        { [`userSettings.${userId}.readAt`]: { $exists: false } },
                        { [`userSettings.${userId}.readAt`]: null },
                    ]
                });
                const chatNameForUser = (chatDetails, userId) => {
                    return chatDetails?.groupName ||
                        chatDetails?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.fullName;
                };
                const chatProfileForUser = (chatDetails, userId) => {
                    return chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? chatDetails?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? defaultImage;
                };
                const otherUser = chat?.participants?.find(participant => participant._id.toString() !== userId.toString());
                const senderData = await UsersModel.findById(userId);

                const displayPicture = chat?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? chat?.participants?.find(participant => participant?._id?.toString?.() != userId?.toString?.())?.profilePicture ?? defaultImage;
                const messageEmitBody = {
                    chatScreenBody: {
                        receiverId: otherUser?._id.toString(),
                        chatId: chat?._id,
                        chatName: chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?.profilePicture,
                        displayPicture,
                        latestMessage: message?.content ?? '',
                        latesMessageId: message?._id,
                        latestMessageType: message?.contentType ?? 'text',
                        contentDescriptionType: message?.contentDescriptionType ?? 'text',
                        latestMessageSentAt: message?.createdAt,
                        latestMessageTitle: message?.contentTitle ?? '',
                        fileSize: message?.fileSize ?? '',
                        latestMessageDescription: message?.contentDescription ?? '',
                        unreadCount: unreadCount ?? 0,

                    },
                    messageScreenBody: {
                        chatId: chat?._id,
                        messageId: message?._id,
                        sender: {
                            _id: userId,
                            name: senderData?.name ?? null,
                            profilePicture: senderData?.profilePicture ?? defaultImage,
                        },
                        content: message?.content ?? null,
                        contentTitle: message?.contentTitle ?? null,
                        fileSize: message?.fileSize ?? '',
                        contentDescription: message?.contentDescription ?? null,
                        contentType: message?.contentType ?? null,
                        contentDescriptionType: message?.contentDescriptionType ?? 'text',


                        editedAt: message?.editedAt ?? null,

                    }
                }
                socket.emit('edit-message-response', {
                    ...messageEmitBody,
                    chatScreenBody: {
                        ...messageEmitBody?.chatScreenBody,
                        chatName: chatNameForUser(chat, userId),
                        displayPicture: chatProfileForUser(chat, userId),
                    },
                });

                const receiverId = chat?.participants?.find(participant => participant?._id?.toString?.() !== userId?.toString?.())?._id;
                console.log(`Receiver id found in edit-message: ${receiverId}`);
                if (receiverId) {
                    // const receiverUserData = await UsersModel.findById(receiverId);
                    // const receiverSocketId = receiverUserData?.active_socket;
                    console.log(`Emitting edit-message-response to receiver ${receiverId} with socket id ${receiverId}`);
                    io.to(receiverId.toString()).emit('edit-message-response', {
                        ...messageEmitBody,
                        chatScreenBody: {
                            ...messageEmitBody?.chatScreenBody,
                            chatName: chatNameForUser(chat, receiverId),
                            displayPicture: chatProfileForUser(chat, receiverId),
                        },
                    });
                }
            } catch (error) {
                console.log(`Got error in edit-message: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in editing message.' });
            }
        });


        socket.on('mark-message-as-read', async (data) => {
            try {
                console.log(`mark-message-as-read event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const markAsReadResponse = await markMessageAsRead({ ...data, userId });
                if (!markAsReadResponse?.success) {
                    console.log(`Got error in mark-message-as-read: ${markAsReadResponse?.message}`);
                    socket.emit('socket-error', { message: markAsReadResponse?.message });
                    return;
                }
                socket.emit('mark-message-read-response', { success: true });
                const { chatId } = markAsReadResponse;
                const chat = await ChatsModel.findById(chatId);
                console.log(`Got chat details for chat ${chatId} in mark-message-as-read: ${JSON.stringify(chat)}`);
                const otherParticipant = chat?.participants?.find(participant => participant.toString() !== userId.toString());
                if (otherParticipant) {
                    const isUserOnline = io.sockets.adapter.rooms.get(otherParticipant?.toString?.()) ? true : false;
                    if (isUserOnline) {
                        console.log(`Emitting mark-message-read-response to user ${otherParticipant} for chat ${chatId}`);
                        io.to(otherParticipant?.toString?.()).emit('mark-message-read-response', { success: true, chatId, allMsgsRead: true });
                    }
                }
            } catch (error) {
                console.log(`Got error in mark-message-as-read: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in marking message as read.' });
            }
        });


        socket.on('get-user-notifications', async (data) => {
            try {
                console.log(`get-user-notifications event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const notifications = await getUserNotifications({ ...data, userId: subAdmin ? subAdmin._id : userId });
                socket.emit('user-notifications', notifications);
            } catch (error) {
                console.log(`Got error in get-user-notifications: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching notifications.' });
            }
        });

        //////////////////////get user unread notifications /////////////////////////
        socket.on('get-user-unread-notifications', async (data) => {
            try {
                console.log(`get-user-unread-notifications event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const notifications = await getUserUnreadNotifications({ ...data, userId: subAdmin ? subAdmin._id : userId });
                console.log('notifications', notifications)

                socket.emit('user-unread-notifications', notifications);
            } catch (error) {
                console.log(`Got error in get-user-unread-notifications: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in fetching unread notifications.' });
            }
        });

        ////////////////////////// read user notifications ////////////////////////////

        socket.on('read-user-notifications', async (data) => {
            try {
                console.log(`read-user-notifications event received for socket ${socketId} and user ${userId} with data: ${JSON.stringify(data)}`);
                const notifications = await readUserNotifications({ ...data, userId });
                socket.emit('read-notifications', {
                    success: notifications,
                    message: 'Notifications marked as read successfully.',
                });
            } catch (error) {
                console.log(`Got error in read-user-notifications: ${(JSON.stringify(error?.stack))}`);
                socket.emit('socket-error', { message: 'Error in reading notifications.' });
            }
        });

    });

}

function getIO() {
    return io;
}

module.exports = {
    initializeSocket,
    getIO
};
