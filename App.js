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

  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'


  // dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

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

    const formattedAmount = txAmount.replace(',', '.');
    const finalAmount = Math.abs(parseFloat(formattedAmount));
    if (isNaN(finalAmount) || finalAmount <= 0) {
      Alert.alert("Chyba", "Please enter a valid positive amount (E.g. 19.90 or 19,90).");
      return;
    }

    if (editingId) {
      // rezim upravty zaznamu
      const { error } = await supabase
        .from('transactions')
        .update({
          title: txTitle,
          amount: finalAmount,
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
            amount: finalAmount, 
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
    }
    // else {
    //   Alert.alert("Success", "Welcome back!")
    // }
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

  const filteredTransactions = transactions.filter(item => {
    if (filterType === 'all') return true; //vse  
    return item.type === filterType; // jen prijmy nebo vydaje
  });

  const colors = isDarkMode ? theme.dark : theme.light;


  // ***** Pages *****
  // --- Main page ---

  if (session) {
    return(
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <View style={styles.headerRow}>
          <Text style={[styles.mainPageTitle, { color: colors.primary }]}>Main page</Text>
          
          <TouchableOpacity 
            style={styles.themeToggle}
            onPress={() => setIsDarkMode(!isDarkMode)}
          >
            <Text style={{ fontSize: 24 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>          
      </View>
      <View style={styles.contentContainer}>
        <Text style={{ color: colors.text }}>Welcome {session.user.email}</Text>
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>
              CURRENT BALANCE:
          </Text>
          <Text style={{ color: colors.primary, fontSize: 36, fontWeight: '800', marginTop: 10 }}>
              {balance} Kč
          </Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.primaryButtonText}>+ Add record</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setHistoryVisible(true)}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Show history</Text>
          </TouchableOpacity>
        </View>
      </View>  
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={{ color: '#ef4444', fontWeight: '600',}}>Sign Out</Text>
      </TouchableOpacity>

    {/* --- Add record page --- */}

        <Modal visible={modalVisible} animationType="slide" transparent={false}>
          <View style={[styles.container, {backgroundColor: colors.background}]}>
            <Text style={{ color: colors.text }}>{editingId ? "Edit record" : "New record"}</Text>
            <Text style={{ color: colors.text }}>Name:</Text>
            <TextInput
              style={{ color: colors.text }}
              placeholder="E.g. Salary, Groceries..."
              placeholderTextColor={colors.textMuted}
              value={txTitle} 
              onChangeText={setTxTitle}
            />

            <Text style={{ color: colors.text }}>Amount:</Text>
            <TextInput 
              style={{ color: colors.text }}
              placeholder="0" 
              placeholderTextColor={colors.textMuted}
              value={txAmount} 
              onChangeText={setTxAmount}
              keyboardType="numeric"
            />

            <Text style={{ color: colors.text }}>Transaction type:</Text>
            <View>
              <TouchableOpacity 
                onPress={() => setTxType('income')}
              >
                <Text style={{ color: colors.text }}>Income</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setTxType('expense')}
              >
                <Text style={{ color: colors.text }}>expense</Text>
              </TouchableOpacity>
            </View>

            {editingId && (
              <TouchableOpacity onPress={handleDeleteTransaction} style={{ marginTop: 15 }}>
                <Text style={{ color: colors.text }}>Delete record</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleAddTransaction}>
              <Text style={{ color: colors.text }}>Save record</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setModalVisible(false); setEditingId(null); setTxTitle(''); setTxAmount(''); }}>
              <Text style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </Modal>

    {/* --- Transaction history page --- */}

        <Modal visible={historyVisible} animationType="slide" transparent={false}>
          <View style={[styles.container, {backgroundColor: colors.background}]}>
            <Text style={{ color: colors.text }}>Transaction history:</Text>

            <View>
              <TouchableOpacity onPress={() => setFilterType('all')}>
                <Text style={{ color: colors.text }}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterType('income')}>
                <Text style={{ color: colors.text }}>Incomes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterType('expense')}>
                <Text style={{ color: colors.text }}>Expenses</Text>
              </TouchableOpacity>                              
            </View>

            {filteredTransactions.length === 0 ? (
              <Text style={{ color: colors.text }}>You don't have any records with this filter here yet.</Text>
            ) : (
              filteredTransactions.map((item) =>  (
                <TouchableOpacity key={item.id} onPress={() => handleOpenEdit(item)}>
                  <View>
                    <Text style={{ color: colors.text }}>{item.title}</Text>
                    <Text style={{ color: colors.text }}>
                      {item.type === 'income' ? '+' : '-'}{item.amount} Kč
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity onPress={() => setHistoryVisible(false)}>
              <Text style={{ color: colors.text }}>Close history</Text>
            </TouchableOpacity>
          </View>
        </Modal>

      </View>
    )
  }

  // -- Login page ---

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={{ color: colors.primary, fontSize: 24, margin: 20 }}>Finance Tracker App</Text>
      <View style={styles.logInPageContainer}>
        <View style={styles.logInPageRow}>
          <Text style={{ color: colors.text, fontSize: 18 }}>E-mail:</Text>
          <TextInput
            style={{ color: colors.text, fontSize: 18  }}
            placeholder="name@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={(text) => setEmail(text)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.logInPageRow}>
          <Text style={{ color: colors.text, fontSize: 18 }}>password:</Text>
          <TextInput
              style={{ color: colors.text, fontSize: 18}}
              placeholder="_____"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(text) => setPassword(text)}
              secureTextEntry={true}
              autoCapitalize="none"
          />
        </View>
      </View>  
      <TouchableOpacity
        onPress={handleLogin}
        style={[styles.logInButton, {borderColor: colors.border}]}
        // disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#f2f2f2" }}>Login</Text>
          )}
      </TouchableOpacity>


      <TouchableOpacity 
        onPress={handleSignUp}
        style={[styles.signUpButton, {borderColor: colors.border}]}
        // disabled={loading}
      >
        <Text style={{ color: "#f2f2f2" }}>SignUp</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

const theme = {
  light: {
    background: '#f2f2f2',
    card: '#f2f2f2', //nepopuzito 
    text: '#2a2a2a',
    textMuted: '#7d7d7d',
    border: '#2a2a2a',  //nepopuzito 
    primary: '#00d238', 
  },
  dark: {
    background: '#2a2a2a', 
    card: '#2a2a2a',  //nepopuzito      
    text: '#f8fafc', 
    textMuted: '#7d7d7d',
    border: '#f2f2f2',  //nepopuzito 
    primary: '#fdfd2d',
  }
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  contentContainer: {
    width: '95%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 30, 
  },
  mainPageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  themeToggle: {
    padding: 5,
  },
  balanceCard: {
    width: '90%',
    padding: 25,
    borderRadius: 16,
    borderWidth: 1,
    margin: 10,
  },
  actionsRow: {
    flexDirection: 'row', // Tlačítka vedle sebe!
    justifyContent: 'space-between',
    width: '90%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 5,
  },
  signOutButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 'auto',
    marginBottom: 30,
    width: '90%',
    borderColor: '#ef4444',
  },
  logInButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 10,
    width: '90%',
  },
  signUpButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    width: '90%',
  },
  logInPageContainer:{
    width: '95%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '50%',
  },
  logInPageRow: {
    flexDirection: 'row',
     alignItems: 'center',
     width: '90%',
  },
  text: {

  }

});
