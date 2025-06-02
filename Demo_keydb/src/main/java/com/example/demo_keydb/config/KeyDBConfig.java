package com.example.demo_keydb.config;

import io.lettuce.core.RedisURI;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import io.lettuce.core.cluster.RedisClusterClient;

import java.util.List;


@Configuration
public class KeyDBConfig {
    @Bean
    public RedisClusterClient redisClusterClient() {
        return RedisClusterClient.create(List.of(
                RedisURI.create("redis://keydb1:6379"),
                RedisURI.create("redis://keydb2:6379"),
                RedisURI.create("redis://keydb3:6379"),
                RedisURI.create("redis://keydb4:6379"),
                RedisURI.create("redis://keydb5:6379"),
                RedisURI.create("redis://keydb6:6379")
        ));
    }


      @Bean
        public StatefulRedisClusterConnection<String, String> connection(RedisClusterClient redisClusterClient) {
          return redisClusterClient.connect();
        }
}

