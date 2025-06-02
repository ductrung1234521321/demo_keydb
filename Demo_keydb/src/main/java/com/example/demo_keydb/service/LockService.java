package com.example.demo_keydb.service;

import io.lettuce.core.cluster.api.sync.RedisAdvancedClusterCommands;
import java.util.UUID;

public class LockService {
    private final RedisAdvancedClusterCommands<String, String> sync;

    public LockService(RedisAdvancedClusterCommands<String, String> sync) {
        this.sync = sync;
    }

    public String acquireLock(String lockKey, long ttlMs) {
        String token = UUID.randomUUID().toString();
        String res = sync.set(lockKey, token, io.lettuce.core.SetArgs.Builder.nx().px(ttlMs));
        return "OK".equals(res) ? token : null;
    }

    public boolean releaseLock(String lockKey, String token) {
        String lua = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
        Long result = sync.eval(lua, io.lettuce.core.ScriptOutputType.INTEGER, new String[]{lockKey}, token);
        return result != null && result == 1;
    }
}

