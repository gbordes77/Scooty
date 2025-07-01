import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { handleScoutCommand, handleScoutAutocomplete } from '../commands/scout';
import { DatabaseService } from '../services/database';
import { CacheService } from '../services/cache';
import { EmbedService } from '../services/embed';

// Mock Discord.js
jest.mock('discord.js');

// Mock services
jest.mock('../services/database');
jest.mock('../services/cache');
jest.mock('../services/embed');

describe('Scout Command', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockAutocompleteInteraction: jest.Mocked<AutocompleteInteraction>;
  let mockDatabase: jest.Mocked<DatabaseService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockEmbedService: jest.Mocked<EmbedService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDatabase = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockCache = new CacheService() as jest.Mocked<CacheService>;
    mockEmbedService = new EmbedService() as jest.Mocked<EmbedService>;

    // Mock interaction
    mockInteraction = {
      options: {
        getString: jest.fn()
      },
      user: {
        username: 'TestUser'
      },
      reply: jest.fn(),
      isRepliable: jest.fn().mockReturnValue(true)
    } as any;

    // Mock autocomplete interaction
    mockAutocompleteInteraction = {
      options: {
        getFocused: jest.fn().mockReturnValue('test')
      },
      respond: jest.fn()
    } as any;
  });

  describe('handleScoutCommand', () => {
    it('should create a new scout successfully', async () => {
      // Arrange
      mockInteraction.options.getString
        .mockReturnValueOnce('OpponentName')
        .mockReturnValueOnce('jeskai_control')
        .mockReturnValueOnce('Test comment');

      mockDatabase.getCurrentEvent.mockResolvedValue({
        id: 'test-event-id',
        name: 'Test Tournament',
        current_round: 1,
        status: 'active',
        start_date: new Date().toISOString()
      });

      mockDatabase.checkDuplicateScout.mockResolvedValue(null);

      mockDatabase.createScout.mockResolvedValue({
        id: 1,
        event_id: 'test-event-id',
        round: 1,
        opponent: 'OpponentName',
        archetype: 'jeskai_control',
        scout_by: 'TestUser',
        comment: 'Test comment',
        created_at: new Date().toISOString()
      });

      mockEmbedService.createScoutEmbed.mockReturnValue({
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis()
      } as any);

      // Act
      await handleScoutCommand(mockInteraction, mockDatabase, mockCache, mockEmbedService);

      // Assert
      expect(mockDatabase.createScout).toHaveBeenCalledWith({
        event_id: 'test-event-id',
        round: 1,
        opponent: 'OpponentName',
        archetype: 'jeskai_control',
        scout_by: 'TestUser',
        comment: 'Test comment'
      });

      expect(mockCache.invalidateScoutCache).toHaveBeenCalledWith('test-event-id');
      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it('should handle duplicate scouts', async () => {
      // Arrange
      mockInteraction.options.getString
        .mockReturnValueOnce('OpponentName')
        .mockReturnValueOnce('jeskai_control')
        .mockReturnValueOnce(null);

      mockDatabase.getCurrentEvent.mockResolvedValue({
        id: 'test-event-id',
        name: 'Test Tournament',
        current_round: 1,
        status: 'active',
        start_date: new Date().toISOString()
      });

      mockDatabase.checkDuplicateScout.mockResolvedValue({
        id: 1,
        event_id: 'test-event-id',
        round: 1,
        opponent: 'OpponentName',
        archetype: 'abzan_sorin',
        scout_by: 'OtherUser',
        comment: 'Previous comment',
        created_at: new Date().toISOString()
      });

      mockDatabase.createScout.mockResolvedValue({
        id: 2,
        event_id: 'test-event-id',
        round: 1,
        opponent: 'OpponentName',
        archetype: 'jeskai_control',
        scout_by: 'TestUser',
        comment: undefined,
        created_at: new Date().toISOString()
      });

      mockEmbedService.createScoutEmbed.mockReturnValue({
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis()
      } as any);

      // Act
      await handleScoutCommand(mockInteraction, mockDatabase, mockCache, mockEmbedService);

      // Assert
      expect(mockDatabase.createScout).toHaveBeenCalled();
      expect(mockEmbedService.createScoutEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          opponent: 'OpponentName',
          archetype: 'jeskai_control'
        }),
        true // isDuplicate
      );
    });

    it('should handle missing current event', async () => {
      // Arrange
      mockDatabase.getCurrentEvent.mockResolvedValue(null);

      mockEmbedService.createErrorEmbed.mockReturnValue({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis()
      } as any);

      // Act
      await handleScoutCommand(mockInteraction, mockDatabase, mockCache, mockEmbedService);

      // Assert
      expect(mockEmbedService.createErrorEmbed).toHaveBeenCalledWith(
        'No active tournament found. Please contact an administrator.'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
        ephemeral: true
      });
    });
  });

  describe('handleScoutAutocomplete', () => {
    it('should return opponent suggestions', async () => {
      // Arrange
      mockAutocompleteInteraction.options.getFocused.mockReturnValue('test');

      mockDatabase.getCurrentEvent.mockResolvedValue({
        id: 'test-event-id',
        name: 'Test Tournament',
        current_round: 1,
        status: 'active',
        start_date: new Date().toISOString()
      });

      mockCache.getOpponentSuggestions.mockResolvedValue([]);
      mockDatabase.searchOpponents.mockResolvedValue(['TestOpponent1', 'TestOpponent2']);
      mockDatabase.checkDuplicateScout.mockResolvedValue(null);

      // Act
      await handleScoutAutocomplete(mockAutocompleteInteraction, mockDatabase, mockCache);

      // Assert
      expect(mockDatabase.searchOpponents).toHaveBeenCalledWith('test', 'test-event-id');
      expect(mockCache.setOpponentSuggestions).toHaveBeenCalledWith('test', 'test-event-id', ['TestOpponent1', 'TestOpponent2']);
      expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('TestOpponent1'),
            value: 'TestOpponent1'
          })
        ])
      );
    });

    it('should handle no active event', async () => {
      // Arrange
      mockDatabase.getCurrentEvent.mockResolvedValue(null);

      // Act
      await handleScoutAutocomplete(mockAutocompleteInteraction, mockDatabase, mockCache);

      // Assert
      expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
        { name: '❌ No active event', value: 'no_event' }
      ]);
    });
  });
}); 