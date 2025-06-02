package com.example.demo_keydb.controller;

import com.example.demo_keydb.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/messages")
public class ChatController {
    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // Join a channel
    @PostMapping("/{channel}/join/{user}")
    public ResponseEntity<String> joinChannel(@PathVariable String channel, @PathVariable String user) {
        chatService.joinChannel(user, channel);
        return ResponseEntity.ok(user + " joined channel " + channel);
    }

    // Leave a channel
    @PostMapping("/{channel}/leave/{user}")
    public ResponseEntity<String> leaveChannel(@PathVariable String channel, @PathVariable String user) {
        chatService.leaveChannel(user, channel);
        return ResponseEntity.ok(user + " left channel " + channel);
    }

    // Send a message to a channel
    @PostMapping("/{channel}/send/{user}")
    public ResponseEntity<String> sendMessage(@PathVariable String channel, @PathVariable String user, @RequestBody String message) {
        chatService.sendMessage(user, channel, message);
        return ResponseEntity.ok("Message sent \"" + message + "\" to channel " + channel);
    }

    // Read all messages from a channel
    @GetMapping("/{channel}/messages")
    public ResponseEntity<List<Map<String, String>>> readChannelMessages(@PathVariable String channel) {
        List<Map<String,String>> messages = chatService.getChannelMessages(channel);
        System.out.println("===> Found messages: " + messages.size());
        return ResponseEntity.ok(messages);
    }


    // Get channels of a user
    @GetMapping("/user/{user}/channels")
    public ResponseEntity<Set<String>> getChannelsOfUser(@PathVariable String user) {
        Set<String> channels = chatService.getChannelsOfUser(user);
        return ResponseEntity.ok(channels);
    }

    // Get user node info
    @GetMapping("/user/{user}/node-info")
    public ResponseEntity<String> getUserNodeInfo(@PathVariable String user) {
        int slot = chatService.getNodeSlotOfUser(user);
        return ResponseEntity.ok("User: " + user + " on slot: " + slot);
    }

    // Xóa tin nhắn của user theo message ID
    @DeleteMapping("/{user}/messages/{messageId}")
    public ResponseEntity<String> deleteMessage(@PathVariable String user, @PathVariable String messageId) {
        chatService.deleteMessage(user, messageId);
        return ResponseEntity.ok("Deleted message with ID: " + messageId);
    }

    // Xóa một user
    @DeleteMapping("/user/{user}")
    public ResponseEntity<String> deleteUser(@PathVariable String user) {
        chatService.deleteUser(user);
        return ResponseEntity.ok("Deleted user: " + user);
    }

    // Xóa một channel
    @DeleteMapping("/channel/{channel}")
    public ResponseEntity<String> deleteChannel(@PathVariable String channel) {
        chatService.deleteChannel(channel);
        return ResponseEntity.ok("Deleted channel: " + channel);
    }

    // Reset một channel với distributed lock, TTL 15s
    @PostMapping("/channel/{channel}/reset")
    public ResponseEntity<String> resetChannelDistributed(@PathVariable String channel, @RequestParam String admin) {
        boolean ok = chatService.resetChannelMessagesDistributed(channel, admin);
        if (ok) {
            return ResponseEntity.ok("Channel " + channel + " đã được reset bởi " + admin);
        } else {
            Long ttl = chatService.getResetLockTTL(channel);
            if (ttl == null || ttl < 0) ttl = 0L;
            return ResponseEntity.status(409).body("Có thao tác reset khác đang thực thi, thử lại sau! TTL còn: " + ttl + " giây");
        }
    }


}
