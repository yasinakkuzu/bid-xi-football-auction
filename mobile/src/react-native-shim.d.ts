declare module 'react-native' {
  import type { ReactNode } from 'react';

  export interface ViewStyle {
    [key: string]: string | number | undefined;
  }
  export type TextStyle = ViewStyle;

  export interface ViewProps {
    style?: ViewStyle | ViewStyle[];
    children?: ReactNode;
    accessibilityRole?: string;
    accessibilityLabel?: string;
  }

  export interface TextProps {
    style?: TextStyle | TextStyle[];
    children?: ReactNode;
    numberOfLines?: number;
  }

  export interface PressableProps extends ViewProps {
    onPress?: () => void;
    disabled?: boolean;
  }

  export interface TextInputProps extends ViewProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    maxLength?: number;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  }

  export function SafeAreaView(props: ViewProps): JSX.Element;
  export function View(props: ViewProps): JSX.Element;
  export function Text(props: TextProps): JSX.Element;
  export function Pressable(props: PressableProps): JSX.Element;
  export function ScrollView(props: ViewProps): JSX.Element;
  export function TextInput(props: TextInputProps): JSX.Element;

  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle>>(styles: T): T;
  };

  export const Share: {
    share(content: { title?: string; message: string; url?: string }): Promise<{ action: string }>;
  };

  export const Vibration: {
    vibrate(pattern?: number | number[]): void;
  };
}

declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
  }
  export enum NotificationFeedbackType {
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
  }
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-linking' {
  export function createURL(path: string, options?: { queryParams?: Record<string, string> }): string;
  export function getInitialURL(): Promise<string | null>;
  export function addEventListener(type: 'url', handler: (event: { url: string }) => void): { remove: () => void };
}

declare module 'expo-status-bar' {
  export function StatusBar(props: { style?: 'light' | 'dark' | 'auto' }): JSX.Element;
}
