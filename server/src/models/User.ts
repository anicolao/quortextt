// User model for MVP (in-memory storage)
// Will be replaced with MongoDB in future iterations

export interface IUser {
  id: string;
  discordId: string;
  displayName: string;
  email?: string;
  avatar?: string;
  provider: 'discord';
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    winStreak: number;
    bestWinStreak: number;
  };
  settings: {
    notifications: boolean;
    soundEnabled: boolean;
    theme: string;
  };
  createdAt: Date;
  lastActive: Date;
}

// In-memory user storage for MVP
const users = new Map<string, IUser>();

export class UserStore {
  static findByDiscordId(discordId: string): IUser | undefined {
    return Array.from(users.values()).find(user => user.discordId === discordId);
  }

  static findById(id: string): IUser | undefined {
    return users.get(id);
  }

  static create(userData: {
    id: string;
    discordId: string;
    displayName: string;
    email?: string;
    avatar?: string;
  }): IUser {
    const user: IUser = {
      ...userData,
      provider: 'discord',
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        winStreak: 0,
        bestWinStreak: 0
      },
      settings: {
        notifications: true,
        soundEnabled: true,
        theme: 'default'
      },
      createdAt: new Date(),
      lastActive: new Date()
    };

    users.set(user.id, user);
    return user;
  }

  static update(id: string, updates: Partial<IUser>): IUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates, lastActive: new Date() };
    users.set(id, updatedUser);
    return updatedUser;
  }

  static delete(id: string): boolean {
    return users.delete(id);
  }

  static getAll(): IUser[] {
    return Array.from(users.values());
  }
}
