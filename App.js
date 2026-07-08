import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { supabase } from './supabase';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState('');
  const [session, setSession] = useState(null); //jestli je nekdo prihlaseny

  // Stavy pro finance
  const [transactions, setTransactions] = useState([]); //vsechny zaznamy
  const [balance, setBalance] = useState(0); // zustatek
  const [modalVisible, setModalVisible] = useState(false); // vyskakovaci okno na pridani zaznamu
  const [historyVisible, setHistoryVisible] = useState(false); // vyskakovaci okno na zobrazeni historie transakci 

  // Stavy pro novy zaznam
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState('income'); // income/expoence (incomo jako default)

  const [editingId, setEditingId] = useState(null); // null = pridavame novou, cislo = upravujeme stavajici

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function getTransactions() {
    if(!session) return;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id) //nacte pouze data uzivatele, ktery je prihlasen
      .order('created_at', {ascending: false});

      if (error) {
      console.log('Error getting data:', error.message);
      } else {
        setTransactions(data);

        // spocitani zustatku
        let totalbalance = 0;
        data.forEach(item => {
          if (item.type == 'income') totalbalance += Number(item.amount);
          if (item.type == 'expense') totalbalance -= Number(item.amount);
        });
        setBalance(totalbalance);
      }
  }
  
  //okamzite nacteni dat po prihlaseni uzivatele
  useEffect(() => {
    if (session) {
      getTransactions();
    }
  }, [session]);

  async function handleAddTransaction() {
    if (!txTitle || !txAmount) {
      Alert.alert("Error", "Please fill in both the name and the amount..");
      return;
    }

    if (editingId) {
      // rezim upravty zaznamu
      const { error } = await supabase
        .from('transactions')
        .update({
          title: txTitle,
          amount: parseFloat(txAmount),
          type: txType
        })
        .eq('id', editingId);

      if (error) {
        Alert.alert("Chyba při úpravě", error.message);
        return;
      }
    } else {
      //rezim pridani zaznamu
      const { error } = await supabase
        .from('transactions')
        .insert([
          { 
            title: txTitle, 
            amount: parseFloat(txAmount), 
            type: txType,
            user_id: session.user.id // propojeni s prihlasenym uzivatelem
          }
        ]);

      if (error) {
        Alert.alert("Error while saving", error.message);
        return; 
      }
    }  

    setTxTitle('');
    setTxAmount('');
    setEditingId(null);
    setModalVisible(false);
    getTransactions(); //prepocteni zustatku
    
  }


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

  async function handleSignOut(){
    await supabase.auth.signOut();
  }

  function handleOpenEdit(item) {
    setEditingId(item.id);
    setTxTitle(item.title);
    setTxAmount(item.amount.toString());
    txType === item.type;
    setHistoryVisible(false);
    setModalVisible(true);
  }

  async function handleDeleteTransaction() {
    if (!editingId) return;

    Alert.alert(
      "Delete record",
      "Do you really want to delete this record?",
      [
        { text: "Zrušit", style: "cancel" },
        { 
          text: "Delete", 
          onPress: async () => {
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', editingId);

            if (error) {
              Alert.alert("Error deleting transaction", error.message);
            } else {
              // Resetovani formulare
              setTxTitle('');
              setTxAmount('');
              setEditingId(null);
              setModalVisible(false);
              getTransactions();
            }
          } 
        }
      ]
    );
  }

  // ***** Pages *****
  // --- Main page ---

  if (session) {
    return(
      <View style={styles.container}>
        <Text>Main page</Text>
        <Text>Welcome {session.user.email}</Text>
        <Text>Balance:</Text>
        <Text>{balance} Kč</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text >+ Add record</Text>
        </TouchableOpacity>

    {/* --- Add record page --- */}

        <Modal visible={modalVisible} animationType="slide" transparent={false}>
          <View style={styles.container}>
            <Text>{editingId ? "Edit record" : "New record"}</Text>
            <Text>Name:</Text>
            <TextInput
              placeholder="E.g. Salary, Groceries..."
              value={txTitle} 
              onChangeText={setTxTitle}
            />

            <Text>Amount:</Text>
            <TextInput 
              placeholder="0" 
              value={txAmount} 
              onChangeText={setTxAmount}
              keyboardType="numeric"
            />

            <Text>Transaction type:</Text>
            <View>
              <TouchableOpacity 
                onPress={() => setTxType('income')}
              >
                <Text>Income</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setTxType('expense')}
              >
                <Text>expense</Text>
              </TouchableOpacity>
            </View>

            {editingId && (
              <TouchableOpacity onPress={handleDeleteTransaction} style={{ marginTop: 15 }}>
                <Text>Delete record</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleAddTransaction}>
              <Text>Save record</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setModalVisible(false); setEditingId(null); setTxTitle(''); setTxAmount(''); }}>
              <Text>Cancel</Text>
            </TouchableOpacity>

          </View>
        </Modal>

        <TouchableOpacity onPress={() => setHistoryVisible(true)}>
          <Text style={styles.addButtonText}>Show history</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut}>
          <Text>SignOut</Text>
        </TouchableOpacity>

    {/* --- Transaction history page --- */}

        <Modal visible={historyVisible} animationType="slide" transparent={false}>
          <View style={styles.container}>
            <Text>Transaction history</Text>

            {transactions.length === 0 ? (
              <Text>You don't have any records here yet.</Text>
            ) : (
              transactions.map((item) =>  (
                <TouchableOpacity key={item.id} onPress={() => handleOpenEdit(item)}>
                  <View>
                    <Text>{item.title}</Text>
                    <Text>
                      {item.type === 'income' ? '+' : '-'}{item.amount} Kč
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity onPress={() => setHistoryVisible(false)}>
              <Text>Close history</Text>
            </TouchableOpacity>
          </View>
        </Modal>

      </View>
    )
  }

  // -- Login page ---

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
