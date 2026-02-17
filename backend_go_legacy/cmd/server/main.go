package main

import (
	"context"
	"log"
	"os"

	"guess-who-backend/internal/ai"
	"guess-who-backend/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize Gemini Client
	ctx := context.Background()
	geminiClient, err := ai.NewGeminiClient(ctx)
	if err != nil {
		log.Printf("Warning: Failed to initialize Gemini client: %v", err)
	} else {
		defer geminiClient.Close()
	}

	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	// Game routes
	api := r.Group("/api")
	api.Use(auth.EnsureValidToken())
	{
		api.POST("/game/start", func(c *gin.Context) {
			// Start game logic (TODO: store game state)
			c.JSON(200, gin.H{"message": "Game started"})
		})
		api.POST("/game/guess", func(c *gin.Context) {
			if geminiClient == nil {
				c.JSON(503, gin.H{"error": "AI service unavailable"})
				return
			}

			// Simple echo for now, would replace with game logic
			var req struct {
				Guess string `json:"guess"`
			}
			if err := c.BindJSON(&req); err != nil {
				c.JSON(400, gin.H{"error": "Invalid request"})
				return
			}

			response, err := geminiClient.GenerateResponse(c.Request.Context(), "User guessed: "+req.Guess+". Reply strictly with 'Yes' or 'No'.")
			if err != nil {
				c.JSON(500, gin.H{"error": "AI error: " + err.Error()})
				return
			}

			c.JSON(200, gin.H{"message": "Guess received", "ai_response": response})
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}
