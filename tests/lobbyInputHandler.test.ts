// Tests for lobby input handler - specifically testing userId propagation in multiplayer mode

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/redux/store';
import { setGameMode } from '../src/redux/actions';
import { multiplayerStore } from '../src/multiplayer/stores/multiplayerStore';
import { LobbyInputHandler } from '../src/input/lobbyInputHandler';
import { LobbyLayout } from '../src/rendering/lobbyLayout';

describe('LobbyInputHandler - userId propagation', () => {
  let handler: LobbyInputHandler;
  
  beforeEach(() => {
    handler = new LobbyInputHandler();
    // Reset Redux store to initial state
    store.dispatch({ type: 'RESET_GAME' });
  });

  it('should include userId in ADD_PLAYER action when in multiplayer mode', () => {
    // Set up multiplayer mode
    store.dispatch(setGameMode('multiplayer', 'test-user-id'));
    
    // Mock multiplayer store to return a user ID
    const mockUserId = 'google:123456789';
    multiplayerStore.setUsername('TestUser', mockUserId);
    
    // Create a mock layout with an edge button
    const mockLayout: Partial<LobbyLayout> = {
      edgeButtons: [
        {
          x: 100,
          y: 100,
          size: 50,
          color: '#FF0000',
          edge: 0,
          rotation: 0
        }
      ],
      exitButtons: [],
      helpButtons: [],
      backButtons: [],
      playerLists: [],
      settingsButton: { x: 0, y: 0, size: 0 },
      startButton: { x: 0, y: 0, size: 0, enabled: false },
      settingsDialog: null
    };
    
    // Spy on store.dispatch to capture the action
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    
    // Click on the edge button (coordinates inside the button)
    handler.handleClick(125, 115, mockLayout as LobbyLayout);
    
    // Find the ADD_PLAYER action in the calls
    const addPlayerCalls = dispatchSpy.mock.calls.filter(
      call => call[0] && typeof call[0] === 'object' && 'type' in call[0] && call[0].type === 'ADD_PLAYER'
    );
    
    // Should have dispatched ADD_PLAYER
    expect(addPlayerCalls.length).toBeGreaterThan(0);
    
    // The action should include userId in the payload
    const addPlayerAction = addPlayerCalls[0][0] as any;
    expect(addPlayerAction.payload).toBeDefined();
    expect(addPlayerAction.payload.userId).toBe(mockUserId);
    expect(addPlayerAction.payload.color).toBe('#FF0000');
    expect(addPlayerAction.payload.edge).toBe(0);
    
    console.log('✓ ADD_PLAYER action includes userId:', addPlayerAction.payload.userId);
  });

  it('should NOT include userId in ADD_PLAYER action when in tabletop mode', () => {
    // Set up tabletop mode
    store.dispatch(setGameMode('tabletop'));
    
    // Create a mock layout with an edge button
    const mockLayout: Partial<LobbyLayout> = {
      edgeButtons: [
        {
          x: 100,
          y: 100,
          size: 50,
          color: '#FF0000',
          edge: 0,
          rotation: 0
        }
      ],
      exitButtons: [],
      helpButtons: [],
      backButtons: [],
      playerLists: [],
      settingsButton: { x: 0, y: 0, size: 0 },
      startButton: { x: 0, y: 0, size: 0, enabled: false },
      settingsDialog: null
    };
    
    // Spy on store.dispatch to capture the action
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    
    // Click on the edge button
    handler.handleClick(125, 115, mockLayout as LobbyLayout);
    
    // Find the ADD_PLAYER action
    const addPlayerCalls = dispatchSpy.mock.calls.filter(
      call => call[0] && typeof call[0] === 'object' && 'type' in call[0] && call[0].type === 'ADD_PLAYER'
    );
    
    // Should have dispatched ADD_PLAYER
    expect(addPlayerCalls.length).toBeGreaterThan(0);
    
    // The action should NOT include userId (it's tabletop mode)
    const addPlayerAction = addPlayerCalls[0][0] as any;
    expect(addPlayerAction.payload?.userId).toBeUndefined();
    
    console.log('✓ ADD_PLAYER action in tabletop mode does not include userId');
  });
});
