import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlayerColor } from '../chess/types';

export type RootStackParamList = {
  Home: undefined;
  NewGame: undefined;
  Game: { gameId: string } | { newGame: { playerColor: PlayerColor; opponentElo: number } };
  History: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
