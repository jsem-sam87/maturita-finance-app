import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both your email and password.")
      return;
    }

    setLoading(true);

    const {data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    } else {
      Alert.alert("Success", "Welcome back!")
    }
  }

  async function handleSignUp() {
      if (!email || !password) {
        Alert.alert("Error", "Please enter both your email and password.")
        return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Registion failed', error.message);
    } else {
      Alert.alert('Success!', 'Your account was created successfully. You can loggin now!');
    }
  }

  return (
    <View style={styles.container}>
      <Text>Welcome!</Text>
      
      <Text>E-mail:</Text>
      <TextInput
        placeholder="jmeno@email.cz"
        value={email}
        onChangeText={(text) => setEmail(text)}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text>password:</Text>
      <TextInput
          placeholder="_____"
          value={password}
          onChangeText={(text) => setPassword(text)}
          secureTextEntry={true}
          autoCapitalize="none"
      />

      <TouchableOpacity
        onPress={handleLogin}
        // disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
      </TouchableOpacity>


      <TouchableOpacity 
        onPress={handleSignUp}
        // disabled={loading}
      >
        <Text>SignUp</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
