package com.example.demo_keydb.service;

import io.lettuce.core.Range;
import io.lettuce.core.StreamMessage;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import io.lettuce.core.cluster.api.sync.RedisAdvancedClusterCommands;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.stream.Collectors;


@Service
public class ChatService {

    private final RedisAdvancedClusterCommands<String, String> sync;
    private final LockService lockService;
    private static final ObjectMapper mapper = new ObjectMapper();

    public ChatService(StatefulRedisClusterConnection<String, String> conn) {
        sync = conn.sync();
        this.lockService = new LockService(sync);
    }

    //user join channel
    public void joinChannel(String user, String channel) {
        sync.sadd("set:user:{"+user+"}:channels",channel);
    }

    //out channel
    public void leaveChannel(String user, String channel) {
        sync.srem("set:users:{"+user+"}:channels", channel);
    }

    public void sendMessage(String user, String channel, String message) {
        long timestamp = System.currentTimeMillis();

        Map<String, String> msg = Map.of(
                "user", user,
                "channel", channel,
                "msg", message,
                "timestamp", String.valueOf(timestamp)
        );

        sync.xadd("stream:user:{" + user + "}:message", msg);
        sync.zadd("zset:user:{" + user + "}:timestamp", timestamp, message);
    }






    //Read all message of user
    public List<Map<String,String>> getAllMessagesOfUser (String user){
        return sync.xrange("stream:user:{"+user+"}:message", Range.create("-","+"))
                .stream()
                .map(StreamMessage::getBody)
                .collect(Collectors.toList());
    }

    // Get channel of user
    public Set<String> getChannelsOfUser(String user){
        return sync.smembers("set:user:{"+user+"}:channels");
    }


    // Get info node (slot) save user
    public int getNodeSlotOfUser(String user){
        String key = "set:user:{"+user+"}:channels";
        return io.lettuce.core.cluster.SlotHash.getSlot(key);
    }


    // get info slot of user
    public void printuserNodeInfo(String user){
        int slot = getNodeSlotOfUser(user);
        System.out.println("User: "+user+" on slot: "+slot);
    }


    // Get messages from all users in a channel sorted by timestamp
    public List<Map<String, String>> getChannelMessages(String channel) {
        Set<String> users = sync.keys("set:user:*:channels").stream()
                .filter(userKey -> sync.sismember(userKey, channel))
                .map(userKey -> userKey.split(":")[2].replace("{", "").replace("}", ""))
                .collect(Collectors.toSet());

        return users.stream()
                .flatMap(user -> getAllMessagesOfUser(user).stream()
                        .filter(msg -> channel.equals(msg.get("channel")))
                        .map(msg -> {
                            Map<String, String> enriched = new HashMap<>(msg);
                            enriched.put("user", user);
                            return enriched;
                        })
                )
                .sorted(Comparator.comparingLong(msg -> Long.parseLong(msg.get("timestamp"))))
                .collect(Collectors.toList());
    }


    // Xóa một tin nhắn theo ID từ stream của user
    public void deleteMessage(String user, String messageId) {
        sync.xdel("stream:user:{"+user+"}:message", messageId);
    }

    // Xóa user và toàn bộ dữ liệu của user đó (tin nhắn, channel)
    public void deleteUser(String user) {
        // Xóa stream tin nhắn của user
        sync.del("stream:user:{" + user + "}:message");

        // Xóa timestamps liên quan
        sync.del("zset:user:{" + user + "}:timestamp");

        // Xóa danh sách channel của user
        sync.del("set:user:{" + user + "}:channels");
    }

    // Xóa một channel khỏi tất cả user (user-centric)
    public void deleteChannel(String channel) {
        List<String> userKeys = sync.keys("set:user:*:channels");
        for (String userKey : userKeys) {
            sync.srem(userKey, channel);
        }

        // Optionally, xóa luôn các tin nhắn liên quan channel khỏi các stream của user
        Set<String> users = userKeys.stream()
                .map(userKey -> userKey.split(":")[2].replace("{", "").replace("}", ""))
                .collect(Collectors.toSet());

        for (String user : users) {
            List<StreamMessage<String, String>> messages = sync.xrange("stream:user:{" + user + "}:message", Range.create("-", "+"));
            for (StreamMessage<String, String> message : messages) {
                if (channel.equals(message.getBody().get("channel"))) {
                    sync.xdel("stream:user:{" + user + "}:message", message.getId());
                }
            }
        }
    }

    public boolean resetChannelMessagesDistributed(String channel, String admin) {
        String lockKey = "lock:reset:{" + channel + "}";
        long ttlMs = 15000; // TTL 15 giây cho lock
        long waitTimeoutMs = 30000; // Thời gian chờ tối đa 30 giây
        long startTime = System.currentTimeMillis();
        String token = null;

        System.out.println("Bắt đầu vòng lặp chờ lock...");

        // Vòng lặp chờ lock
        while (token == null && System.currentTimeMillis() - startTime < waitTimeoutMs) {
            token = lockService.acquireLock(lockKey, ttlMs);
            System.out.println("Thử acquireLock: " + token);
            if (token == null) {
                try {
                    System.out.println("Chưa lấy được lock, ngủ 1s rồi thử lại...");
                    Thread.sleep(1000); // chờ 1 giây rồi thử lại
                } catch (InterruptedException e) {
                    System.out.println("Thread bị interrupt khi chờ lock!");
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        if (token == null) {
            System.out.println("Không lấy được lock sau " + (System.currentTimeMillis() - startTime) + "ms.");
            return false; // Không lấy được lock sau thời gian chờ
        }

        try {
            System.out.println("Đã acquire lock, set cờ reset và ngủ 10s...");
            // Đặt cờ reset (expire 15 giây)
            sync.setex("resetting:{" + channel + "}", ttlMs / 1000, "true");

            // Delay thêm 10 giây để giữ hàm chạy lâu
            Thread.sleep(10000);

            System.out.println("Bắt đầu xóa message...");
            // Xóa toàn bộ message như cũ
            Set<String> users = sync.keys("set:user:*:channels").stream()
                    .filter(userKey -> sync.sismember(userKey, channel))
                    .map(userKey -> userKey.split(":")[2].replace("{", "").replace("}", ""))
                    .collect(Collectors.toSet());

            System.out.println("Danh sách user sẽ xóa message: " + users);

            for (String user : users) {
                List<StreamMessage<String, String>> messages = sync.xrange("stream:user:{" + user + "}:message", Range.create("-", "+"));
                for (StreamMessage<String, String> message : messages) {
                    if (channel.equals(message.getBody().get("channel"))) {
                        System.out.println("Xóa message: " + message.getId() + " của user: " + user);
                        sync.xdel("stream:user:{" + user + "}:message", message.getId());
                    }
                }
            }
            System.out.println("Xóa message xong.");
            return true;
        } catch (InterruptedException e) {
            System.out.println("Thread bị interrupt khi sleep!");
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception ex) {
            System.out.println("Có lỗi xảy ra: " + ex.getMessage());
            ex.printStackTrace();
            return false;
        } finally {
            System.out.println("Xóa cờ reset và giải phóng lock.");
            // Xóa cờ reset (an toàn phòng expire chưa hết)
            sync.del("resetting:{" + channel + "}");
            lockService.releaseLock(lockKey, token);
        }
    }


    public Long getResetLockTTL(String channel) {
        return sync.ttl("resetting:{" + channel + "}");
    }




}
