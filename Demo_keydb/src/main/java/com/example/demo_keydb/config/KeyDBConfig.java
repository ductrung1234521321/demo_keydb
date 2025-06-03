package com.example.demo_keydb.config;

import io.lettuce.core.RedisURI;
import io.lettuce.core.cluster.ClusterClientOptions;
import io.lettuce.core.cluster.ClusterTopologyRefreshOptions;
import io.lettuce.core.cluster.RedisClusterClient;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

@Configuration
public class KeyDBConfig {
    @Bean
    public RedisClusterClient redisClusterClient() {
        List<RedisURI> uris = List.of(
                RedisURI.Builder.redis("keydb1", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build(),
                RedisURI.Builder.redis("keydb2", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build(),
                RedisURI.Builder.redis("keydb3", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build(),
                RedisURI.Builder.redis("keydb4", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build(),
                RedisURI.Builder.redis("keydb5", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build(),
                RedisURI.Builder.redis("keydb6", 6379)
                        .withTimeout(Duration.ofSeconds(4)).build()
        );
        RedisClusterClient client = RedisClusterClient.create(uris);

        ClusterTopologyRefreshOptions topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
                .enablePeriodicRefresh(Duration.ofSeconds(5))
                .enableAllAdaptiveRefreshTriggers()
                .build();

        ClusterClientOptions clusterClientOptions = ClusterClientOptions.builder()
                .topologyRefreshOptions(topologyRefreshOptions)
                .autoReconnect(true)
                .build();

        client.setOptions(clusterClientOptions);
        return client;
    }

    @Bean(destroyMethod = "close")
    public StatefulRedisClusterConnection<String, String> connection(RedisClusterClient redisClusterClient) {
        // Lettuce sẽ tự động cập nhật cluster topology khi bất kỳ node nào alive
        return redisClusterClient.connect();
    }
}
