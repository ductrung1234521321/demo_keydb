//package com.example.demo_keydb.config;
//
//import lombok.AccessLevel;
//import lombok.RequiredArgsConstructor;
//import lombok.experimental.FieldDefaults;
//import org.springframework.beans.factory.annotation.Configurable;
//import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
//
//@Configurable
//@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
//@RequiredArgsConstructor
//public class SwaggerConfig implements WebMvcConfigurer {
//    AppValue appValue;
//
//
//    @Bean
//    public OpenAPI openAPI() {
//
//        return new OpenAPI()
//                .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
//                .components(new Components().addSecuritySchemes("Bearer Authentication", createAPIKeyScheme()))
//                .info(new Info().title("Master English API")
//                        .version("2.0.0")
//                        .description("Some custom description of API."))
//                .addServersItem(new Server().url("http://localhost:8080" + appValue.getEndpoint_prefix())
//                        .description("Local server"))
//                .addServersItem(new Server().url("https://gateway.dev.meu-solutions.com/englishmaster" + appValue.getEndpoint_prefix())
//                        .description("Production server"));
//}
